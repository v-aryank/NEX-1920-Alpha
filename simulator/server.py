"""Local, dependency-free WebSocket v1 simulator for the NEXDRIVE browser app."""
import base64, hashlib, json, select, socketserver, struct, time

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

class Vehicle:
    def __init__(self):
        self.connected = False; self.armed = False; self.estop = True
        self.throttle = self.steering = 0.0; self.last_drive = 0.0
        self.sequence = None

    def handle(self, msg, now=None):
        now = time.monotonic() if now is None else now
        if (not isinstance(msg, dict) or type(msg.get("version")) is not int or msg.get("version") != 1
                or type(msg.get("sequence")) is not int or not 0 <= msg["sequence"] <= 0xffffffff):
            return {"version": 1, "type": "error", "message": "unsupported_or_invalid_envelope"}
        seq = msg["sequence"]
        if self.sequence is not None and not (0 < ((seq - self.sequence + 2**31) % 2**32) - 2**31):
            return {"version": 1, "type": "error", "sequence": seq, "message": "stale_sequence"}
        self.sequence = seq
        kind = msg.get("type")
        if kind == "hello":
            self.connected = True; self.armed = False; self.throttle = self.steering = 0; self.last_drive = now
            return {"version": 1, "type": "acknowledge", "sequence": seq, "action": "hello"}
        if not self.connected: return {"version": 1, "type": "error", "sequence": seq, "message": "hello_required"}
        if kind == "heartbeat": return {"version": 1, "type": "acknowledge", "sequence": seq, "action": "heartbeat"}
        if kind == "arm":
            self.armed = True; self.estop = False; self.throttle = self.steering = 0; self.last_drive = now
            return {"version": 1, "type": "acknowledge", "sequence": seq, "action": "arm"}
        if kind == "stop":
            self.armed = False; self.estop = True; self.throttle = self.steering = 0
            return {"version": 1, "type": "acknowledge", "sequence": seq, "action": "stop"}
        if kind == "drive":
            t, s = msg.get("throttle"), msg.get("steering")
            if not isinstance(t, (int, float)) or isinstance(t, bool) or not isinstance(s, (int, float)) or isinstance(s, bool) or not all(map(lambda x: abs(x) <= 1 and x == x and abs(x) != float('inf'), (t,s))):
                return {"version": 1, "type": "error", "sequence": seq, "message": "drive_axis_out_of_range"}
            if not self.armed: return {"version": 1, "type": "error", "sequence": seq, "message": "session_disarmed"}
            self.throttle, self.steering, self.last_drive = float(t), float(s), now
            return None
        return {"version": 1, "type": "error", "sequence": seq, "message": "unknown_message_type"}

    def watchdog(self, now=None):
        now = time.monotonic() if now is None else now
        if self.armed and now - self.last_drive > .5:
            self.armed = False; self.estop = True; self.throttle = self.steering = 0

    def telemetry(self):
        scale = max(1.0, abs(self.throttle+self.steering), abs(self.throttle-self.steering))
        return {"version":1,"type":"telemetry","simulated":True,"firmware":"simulator","protocol":1,"board":"simulated","driver":"simulated","vehicle":"2wd","watchdog":"ok","armed":self.armed,"estop":self.estop,"command_age_ms":int((time.monotonic()-self.last_drive)*1000),"left_output":(self.throttle+self.steering)/scale if self.armed else 0,"right_output":(self.throttle-self.steering)/scale if self.armed else 0,"ip":"127.0.0.1","battery_voltage":None,"speed":None}

def read_exact(sock, count):
    data = b""
    while len(data) < count:
        chunk = sock.recv(count-len(data))
        if not chunk: raise ConnectionError("closed")
        data += chunk
    return data

def recv_frame(sock):
    h=read_exact(sock,2); op=h[0]&15; size=h[1]&127
    if size==126:size=struct.unpack("!H",read_exact(sock,2))[0]
    elif size==127:size=struct.unpack("!Q",read_exact(sock,8))[0]
    mask=read_exact(sock,4) if h[1]&128 else b""
    data=read_exact(sock,size)
    if mask:data=bytes(b^mask[i%4] for i,b in enumerate(data))
    return op,data

def send_frame(sock, payload, opcode=1):
    data=payload if isinstance(payload,bytes) else payload.encode()
    n=len(data); head=bytes([0x80|opcode])+(bytes([n]) if n<126 else b"\x7e"+struct.pack("!H",n) if n<65536 else b"\x7f"+struct.pack("!Q",n))
    sock.sendall(head+data)

class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        sock=self.request; headers=b""
        while b"\r\n\r\n" not in headers: headers+=sock.recv(1024)
        rows=headers.decode("latin1").split("\r\n"); values={r.split(":",1)[0].lower():r.split(":",1)[1].strip() for r in rows[1:] if ":" in r}
        key=values.get("sec-websocket-key")
        if not key or values.get("upgrade","").lower()!="websocket":return
        accept=base64.b64encode(hashlib.sha1((key+GUID).encode()).digest()).decode()
        sock.sendall(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "+accept+"\r\n\r\n").encode())
        vehicle=Vehicle(); last_telemetry=0
        try:
            while True:
                vehicle.watchdog()
                ready,_,_=select.select([sock],[],[],.05)
                try:
                    if not ready: continue
                    op,data=recv_frame(sock)
                    if op==8:break
                    if op==9:send_frame(sock,data,10);continue
                    try: response=vehicle.handle(json.loads(data))
                    except (ValueError,UnicodeDecodeError): response={"version":1,"type":"error","message":"invalid_json"}
                    if response:send_frame(sock,json.dumps(response,separators=(",",":")))
                except socket.timeout:pass
                if vehicle.connected and time.monotonic()-last_telemetry>=.5:
                    send_frame(sock,json.dumps(vehicle.telemetry(),separators=(",",":")));last_telemetry=time.monotonic()
        except (ConnectionError,OSError):pass
        finally: vehicle.connected=False;vehicle.armed=False;vehicle.estop=True;vehicle.throttle=vehicle.steering=0

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address=True; daemon_threads=True

if __name__=="__main__":
    with Server(("0.0.0.0",8765),Handler) as server:
        print("NEXDRIVE SIMULATOR listening on ws://0.0.0.0:8765 (simulation only)")
        server.serve_forever()
