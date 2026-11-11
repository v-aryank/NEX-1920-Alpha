import base64, json, os, pathlib, socket, sys, threading, unittest
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from server import Server, Handler, send_frame, recv_frame

class WebSocketServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try: cls.server=Server(("127.0.0.1",0),Handler)
        except PermissionError as error: raise unittest.SkipTest(f"sandbox disallows local socket binds: {error}")
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close()
    def send_masked(self, sock, value):
        data=json.dumps(value,separators=(",",":")).encode();mask=os.urandom(4);n=len(data)
        header=bytes([0x81,0x80|n]) if n<126 else bytes([0x81,0x80|126])+__import__('struct').pack('!H',n)
        sock.sendall(header+mask+bytes(b^mask[i%4] for i,b in enumerate(data)))
    def read_json(self,sock):
        op,data=recv_frame(sock);self.assertEqual(op,1);return json.loads(data)
    def test_browser_websocket_handshake_and_control_round_trip(self):
        sock=socket.create_connection(self.server.server_address,timeout=2)
        sock.settimeout(2);key=base64.b64encode(os.urandom(16)).decode()
        sock.sendall((f"GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        self.assertIn(b"101 Switching Protocols",sock.recv(1024))
        self.send_masked(sock,{"version":1,"type":"hello","sequence":1})
        self.assertEqual(self.read_json(sock)["action"],"hello")
        self.assertTrue(self.read_json(sock)["simulated"])
        self.send_masked(sock,{"version":1,"type":"arm","sequence":2})
        self.assertEqual(self.read_json(sock)["action"],"arm")
        sock.close()

if __name__=="__main__":unittest.main()
