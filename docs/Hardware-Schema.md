# Hardware profiles

Logical vehicle: differential drive, two channels. 2WD maps one motor per side. 4WD groups front/rear motors on each side; firmware may distribute each logical side output. Combined current and driver thermal limits must be checked before parallel motors are connected.

Supported driver profile identifiers are `tb6612fng` and `l298n`. They have distinct electrical characteristics and must not share assumed pin/PWM configuration. No GPIO pin assignment is prescribed. The selected ESP32 board, motor stall current, supply voltage, driver limits and cooling must be checked before deployment.
