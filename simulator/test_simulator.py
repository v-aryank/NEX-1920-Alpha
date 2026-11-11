import pathlib, sys, unittest
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from server import Vehicle

class SimulatorProtocolTests(unittest.TestCase):
    def setUp(self): self.v=Vehicle()
    def msg(self, typ, seq, **kw): return {"version":1,"type":typ,"sequence":seq,**kw}
    def test_handshake_arm_drive_mix_and_telemetry_marking(self):
        self.assertEqual(self.v.handle(self.msg("hello",1),0)["action"],"hello")
        self.assertEqual(self.v.handle(self.msg("arm",2),.01)["action"],"arm")
        self.v.handle(self.msg("drive",3,throttle=.8,steering=.4),.02)
        t=self.v.telemetry();self.assertTrue(t["simulated"]);self.assertEqual(t["left_output"],1);self.assertAlmostEqual(t["right_output"],1/3)
        self.assertIsNone(t["battery_voltage"]);self.assertIsNone(t["speed"])
    def test_sequence_version_and_axes_rejected(self):
        self.v.handle(self.msg("hello",2),0)
        self.assertEqual(self.v.handle(self.msg("heartbeat",2),.01)["message"],"stale_sequence")
        self.assertEqual(self.v.handle({"version":9,"type":"arm","sequence":3},.02)["message"],"unsupported_or_invalid_envelope")
        self.v.handle(self.msg("arm",3),.03)
        self.assertEqual(self.v.handle(self.msg("drive",4,throttle=2,steering=0),.04)["message"],"drive_axis_out_of_range")
        self.assertEqual(self.v.handle(self.msg("drive",5,throttle=float("nan"),steering=0),.05)["message"],"drive_axis_out_of_range")
    def test_stop_latch_disconnect_and_explicit_rearm(self):
        self.v.handle(self.msg("hello",1),0);self.v.handle(self.msg("arm",2),.01)
        self.v.handle(self.msg("drive",3,throttle=1,steering=0),.02)
        self.v.handle(self.msg("stop",4),.03)
        self.assertFalse(self.v.armed);self.assertEqual(self.v.throttle,0)
        self.assertEqual(self.v.handle(self.msg("drive",5,throttle=1,steering=0),.04)["message"],"session_disarmed")
        self.v.handle(self.msg("arm",6),.05);self.assertTrue(self.v.armed)
        self.v.watchdog(.56);self.assertFalse(self.v.armed);self.assertTrue(self.v.estop)
        self.v.connected=False
        self.v.handle(self.msg("hello",7),.6)
        self.assertFalse(self.v.armed);self.assertTrue(self.v.estop)
        self.assertEqual(self.v.handle(self.msg("drive",8,throttle=1,steering=0),.61)["message"],"session_disarmed")
    def test_heartbeat_does_not_keep_stale_motion_alive(self):
        self.v.handle(self.msg("hello",1),0);self.v.handle(self.msg("arm",2),.01);self.v.handle(self.msg("drive",3,throttle=.5,steering=0),.02)
        self.v.handle(self.msg("heartbeat",4),.4);self.v.watchdog(.53)
        self.assertFalse(self.v.armed);self.assertEqual(self.v.throttle,0)

if __name__=="__main__": unittest.main()
