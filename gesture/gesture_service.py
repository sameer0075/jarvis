# import cv2
# import mediapipe as mp
# import requests
# import time
# import math
# import pyautogui
# import threading
# import subprocess
# import os

# try:
#     import Quartz
#     import CoreFoundation
#     _SW_PT_DELTA_AXIS1 = 0
#     _SW_PT_DELTA_AXIS2 = 1
#     _SW_SCROLL_PHASE   = 99
#     _SW_IS_CONTINUOUS  = 6
#     _PH_BEGAN    = 1
#     _PH_CHANGED  = 2
#     _PH_ENDED    = 4
#     _PH_MAY_BEGIN = 128
#     QUARTZ_OK = True
# except ImportError:
#     QUARTZ_OK = False

# try:
#     from pynput.mouse import Listener as PynputMouse
#     PYNPUT_OK = True
# except ImportError:
#     PYNPUT_OK = False

# # ── Try to import pynput keyboard for reliable key sending ───────────────────
# try:
#     from pynput.keyboard import Key, Controller as KeyController
#     _kb = KeyController()
#     PYNPUT_KB = True
# except ImportError:
#     PYNPUT_KB = False

# TOUCHPAD_AVAILABLE = QUARTZ_OK or PYNPUT_OK

# pyautogui.FAILSAFE = False
# pyautogui.PAUSE    = 0

# API        = "http://localhost:3001/api/gesture"
# mp_hands   = mp.solutions.hands
# mp_drawing = mp.solutions.drawing_utils

# # HUD colors (BGR)
# CYAN   = (255, 220,   0)
# ORANGE = (  0, 140, 255)
# GREEN  = (  0, 255, 150)
# RED    = (  0,  60, 255)
# DIM    = ( 55,  55,  55)
# WHITE  = (230, 230, 230)

# COOLDOWN   = 0.75
# SWIPE_CD   = 0.80
# HOLD_SEC   = 0.55
# DBL_CLICK_WIN = 0.50
# SWIPE_H_THRESH = 4

# GESTURE_ICONS = {
#     "point":     "☝️",
#     "peace":     "✌️",
#     "fist":      "✊",
#     "three":     "🤟",
#     "open_palm": "🖐️",
#     "pinky":     "🤙",
#     "unknown":   "❓",
# }

# SCREEN_W, SCREEN_H = pyautogui.size()


# # ─────────────────────────────────────────────────────────────────────────────
# # KEY SENDER — the single source of truth for sending keys on macOS
# # Uses pynput if available (most reliable), falls back to AppleScript, then pyautogui
# # ─────────────────────────────────────────────────────────────────────────────

# def send_ctrl_arrow(direction: str):
#     """
#     Send Ctrl+Left or Ctrl+Right arrow for Mission Control space switching.
#     direction: "left" or "right"
#     """
#     # Method 1: pynput (most reliable, bypasses focus issues)
#     if PYNPUT_KB:
#         try:
#             with _kb.pressed(Key.ctrl):
#                 _kb.press(Key.right if direction == "right" else Key.left)
#                 _kb.release(Key.right if direction == "right" else Key.left)
#             return
#         except Exception as e:
#             print(f"[KEY] pynput failed: {e}")

#     # Method 2: AppleScript (works even without Accessibility permission for key events)
#     keycode = 124 if direction == "right" else 123  # right=124, left=123 (macOS key codes)
#     script = f"""
#     tell application "System Events"
#         key code {keycode} using {{control down}}
#     end tell
#     """
#     try:
#         subprocess.run(["osascript", "-e", script], timeout=1, capture_output=True)
#         return
#     except Exception as e:
#         print(f"[KEY] AppleScript failed: {e}")

#     # Method 3: pyautogui fallback
#     try:
#         pyautogui.hotkey("ctrl", "right" if direction == "right" else "left")
#     except Exception as e:
#         print(f"[KEY] pyautogui fallback failed: {e}")


# def send_ctrl_tab(direction: str):
#     """
#     Send Cmd+Option+Right/Left for tab switching in browsers.
#     direction: "left" or "right"
#     """
#     if PYNPUT_KB:
#         try:
#             with _kb.pressed(Key.cmd):
#                 with _kb.pressed(Key.alt):
#                     _kb.press(Key.right if direction == "right" else Key.left)
#                     _kb.release(Key.right if direction == "right" else Key.left)
#             return
#         except Exception as e:
#             print(f"[KEY] pynput tab failed: {e}")

#     keycode = 124 if direction == "right" else 123
#     script = f"""
#     tell application "System Events"
#         key code {keycode} using {{command down, option down}}
#     end tell
#     """
#     try:
#         subprocess.run(["osascript", "-e", script], timeout=1, capture_output=True)
#         return
#     except Exception as e:
#         print(f"[KEY] AppleScript tab failed: {e}")

#     try:
#         pyautogui.hotkey("command", "option", "right" if direction == "right" else "left")
#     except Exception as e:
#         print(f"[KEY] pyautogui tab fallback failed: {e}")


# # ─────────────────────────────────────────────────────────────────────────────
# # One-Euro adaptive filter
# # ─────────────────────────────────────────────────────────────────────────────
# class OneEuro:
#     def __init__(self, mincutoff=1.2, beta=0.006):
#         self.mc  = mincutoff
#         self.b   = beta
#         self.xp  = None
#         self.dxp = 0.0
#         self.tp  = None

#     def _a(self, cutoff, dt):
#         tau = 1.0 / (2 * math.pi * cutoff)
#         return 1.0 / (1.0 + tau / dt)

#     def __call__(self, x):
#         now = time.time()
#         if self.xp is None:
#             self.xp, self.tp = x, now
#             return x
#         dt   = max(now - self.tp, 1e-6)
#         self.tp = now
#         dx   = (x - self.xp) / dt
#         adx  = self._a(1.0, dt)
#         dxh  = adx * dx + (1 - adx) * self.dxp
#         cut  = self.mc + self.b * abs(dxh)
#         a    = self._a(cut, dt)
#         xh   = a * x + (1 - a) * self.xp
#         self.xp, self.dxp = xh, dxh
#         return xh


# # ─────────────────────────────────────────────────────────────────────────────
# # Mac Trackpad listener (2-finger swipe → spaces)
# # ─────────────────────────────────────────────────────────────────────────────
# class TrackpadListener:
#     _jarvis = None
#     _h_delta = 0
#     _v_delta = 0
#     _active = False
#     _suppress = False

#     @classmethod
#     def start(cls, jarvis):
#         if not TOUCHPAD_AVAILABLE:
#             print("  🔘 Install pynput for touchpad: pip install pynput")
#             return
#         cls._jarvis = jarvis
#         if QUARTZ_OK:
#             t = threading.Thread(target=cls._start_quartz, daemon=True)
#             t.start()
#         elif PYNPUT_OK:
#             cls._run_pynput()

#     @classmethod
#     def _start_quartz(cls):
#         kCGEventGesture = 29
#         kCGEventSwipe   = 31
#         mask = (Quartz.CGEventMaskBit(Quartz.kCGEventScrollWheel) |
#                 Quartz.CGEventMaskBit(kCGEventGesture) |
#                 Quartz.CGEventMaskBit(kCGEventSwipe))
#         H_SUPPRESS_DIST = 4

#         def handler(proxy, etype, event, refcon):
#             try:
#                 if etype == Quartz.kCGEventScrollWheel:
#                     phase = Quartz.CGEventGetIntegerValueField(event, _SW_SCROLL_PHASE)
#                     if phase == 0:
#                         return event
#                     dx = Quartz.CGEventGetIntegerValueField(event, _SW_PT_DELTA_AXIS1)
#                     dy = Quartz.CGEventGetIntegerValueField(event, _SW_PT_DELTA_AXIS2)

#                     if phase == _PH_BEGAN:
#                         cls._h_delta = 0
#                         cls._v_delta = 0
#                         cls._active = True
#                         cls._suppress = False
#                         return None
#                     elif phase == _PH_CHANGED and cls._active:
#                         cls._h_delta += dx
#                         cls._v_delta += dy
#                         if abs(cls._h_delta) >= H_SUPPRESS_DIST and abs(cls._v_delta) < abs(cls._h_delta) * 0.6:
#                             cls._suppress = True
#                         return event
#                     elif phase == _PH_ENDED and cls._active:
#                         cls._active = False
#                         cls._check_swipe()
#                         if cls._suppress:
#                             return None
#                     elif phase == _PH_MAY_BEGIN:
#                         cls._active = False
#                         cls._suppress = False
#                 elif etype in (kCGEventGesture, kCGEventSwipe):
#                     dx = Quartz.CGEventGetIntegerValueField(event, _SW_PT_DELTA_AXIS1)
#                     dy = Quartz.CGEventGetIntegerValueField(event, _SW_PT_DELTA_AXIS2)
#                     if abs(dx) >= SWIPE_H_THRESH:
#                         TrackpadListener._fire("swipe_h", "R" if dx > 0 else "L")
#                         return None
#             except Exception:
#                 pass
#             return event

#         tap = Quartz.CGEventTapCreate(
#             Quartz.kCGHIDEventTap,
#             Quartz.kCGHeadInsertEventTap,
#             Quartz.kCGEventTapOptionDefault,
#             mask,
#             handler,
#             None,
#         )
#         if not tap:
#             tap = Quartz.CGEventTapCreate(
#                 Quartz.kCGAnnotatedSessionEventTap,
#                 Quartz.kCGHeadInsertEventTap,
#                 Quartz.kCGEventTapOptionDefault,
#                 mask,
#                 handler,
#                 None,
#             )
#         if not tap:
#             print("[TOUCHPAD] Event tap failed. Grant Accessibility & restart Terminal.")
#             return

#         print("[TOUCHPAD] Listener active (Quartz)")
#         Quartz.CGEventTapEnable(tap, True)
#         src = CoreFoundation.CFMachPortCreateRunLoopSource(None, tap, 0)
#         rl = CoreFoundation.CFRunLoopGetCurrent()
#         CoreFoundation.CFRunLoopAddSource(rl, src, CoreFoundation.kCFRunLoopDefaultMode)
#         while True:
#             CoreFoundation.CFRunLoopRunInMode(CoreFoundation.kCFRunLoopDefaultMode, 0.2, False)
#             time.sleep(0.01)

#     @classmethod
#     def _run_pynput(cls):
#         def on_scroll(x, y, dx, dy):
#             if abs(dx) > abs(dy) and abs(dx) > 1:
#                 TrackpadListener._fire("swipe_h", "R" if dx > 0 else "L")
#             return True
#         try:
#             with PynputMouse(on_scroll=on_scroll) as listener:
#                 print("[TOUCHPAD] Listener active (pynput)")
#                 listener.join()
#         except Exception as e:
#             print(f"[TOUCHPAD] pynput error: {e}")

#     @classmethod
#     def _check_swipe(cls):
#         h, v = cls._h_delta, cls._v_delta
#         if abs(h) >= SWIPE_H_THRESH and abs(v) < abs(h) * 0.6:
#             cls._fire("swipe_h", "R" if h > 0 else "L")

#     @classmethod
#     def _fire(cls, kind, direction):
#         if not cls._jarvis:
#             return
#         j = cls._jarvis
#         now = time.time()
#         if now - j.last_swipe_t < SWIPE_CD:
#             return
#         j.last_swipe_t = now

#         if kind == "swipe_h":
#             # ✅ FIX: use send_ctrl_arrow instead of pyautogui.hotkey
#             if direction == "R":
#                 j.label("NEXT SPACE →")
#                 send_ctrl_arrow("right")
#             else:
#                 j.label("← PREV SPACE")
#                 send_ctrl_arrow("left")


# # ─────────────────────────────────────────────────────────────────────────────
# class Jarvis:
#     def __init__(self):
#         self.detector = mp_hands.Hands(
#             max_num_hands=1, model_complexity=1,
#             min_detection_confidence=0.78,
#             min_tracking_confidence=0.78,
#         )
#         self.cap = cv2.VideoCapture(0)
#         self.cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
#         self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

#         self.WIN_W, self.WIN_H = 340, 260
#         cv2.namedWindow("JARVIS", cv2.WINDOW_NORMAL)
#         cv2.resizeWindow("JARVIS", self.WIN_W, self.WIN_H)
#         cv2.moveWindow("JARVIS", SCREEN_W - self.WIN_W - 20, 40)

#         self.hist          = []
#         self.last_cmd_t    = 0
#         self.hold_shape    = None
#         self.hold_t        = 0
#         self.flash_label   = ""
#         self.flash_t       = 0

#         self.mouse_mode    = False
#         self.dragging      = False
#         self.pinch_open    = True
#         self.last_click_t  = 0
#         self.last_scroll_t = 0
#         self.fx            = OneEuro(mincutoff=2.0, beta=0.004)
#         self.fy            = OneEuro(mincutoff=2.0, beta=0.004)

#         self.last_swipe_t = 0
#         self._prev_shape   = None

#         self.scroll_fy   = OneEuro(mincutoff=1.5, beta=0.03)
#         self.scroll_sy   = None
#         self.scroll_last = 0
#         self.scroll_accum = 0.0

#         self.fps     = 0
#         self.fcount  = 0
#         self.ftimer  = time.time()

#         TrackpadListener.start(self)

#     # ── geometry ─────────────────────────────────────────────────────────────
#     def d(self, a, b):
#         return math.hypot(a.x - b.x, a.y - b.y)

#     def ext(self, lm, tip, pip):
#         return self.d(lm[tip], lm[0]) > self.d(lm[pip], lm[0]) * 0.92

#     def classify(self, lm):
#         i = self.ext(lm,  8,  6)
#         m = self.ext(lm, 12, 10)
#         r = self.ext(lm, 16, 14)
#         p = self.ext(lm, 20, 18)
#         n = i + m + r + p
#         tt, ip, wr = lm[4], lm[3], lm[0]

#         if n == 0:
#             if tt.y < ip.y - 0.02 and tt.y < wr.y: return "thumb_up"
#             if tt.y > ip.y + 0.02 and tt.y > wr.y: return "thumb_down"
#             return "fist"
#         if n == 4: return "open_palm"
#         if i and m and r and not p: return "three"
#         if i and m and not r and not p: return "peace"
#         if i and not m and not r and not p: return "point"
#         if not i and not m and not r and p: return "pinky"
#         return "unknown"

#     def stable(self, win=6):
#         if len(self.hist) < win: return "unknown"
#         c = {}
#         for h in self.hist[-win:]: c[h["shape"]] = c.get(h["shape"], 0) + 1
#         best = max(c, key=c.get)
#         return best if c[best] >= win * 0.6 else "unknown"


#     def swipe(self, shape, min_dx=0.03, max_dy=0.30, ms=1200):
#         if len(self.hist) < 3: return None
#         recent = self.hist[-3:]
#         if recent[-1]["shape"] != shape: return None
#         if sum(1 for h in recent if h["shape"] == shape) < 2: return None
#         r  = self.hist[-3:]
#         dx = r[-1]["x"] - r[0]["x"]
#         dy = r[-1]["y"] - r[0]["y"]
#         dt = (r[-1]["t"] - r[0]["t"]) * 1000
#         if abs(dy) > max_dy: return None
#         if abs(dx) < min_dx: return None
#         if dt > ms:          return None
#         return "R" if dx > 0 else "L"

#     def check_hold(self, shape, now):
#         if shape in ("pinky",):
#             if self.hold_shape == shape:
#                 if now - self.hold_t >= HOLD_SEC:
#                     self.hold_shape = None
#                     return shape
#             else:
#                 self.hold_shape = shape
#                 self.hold_t     = now
#         else:
#             self.hold_shape = None
#         return None

#     # ── action firing ─────────────────────────────────────────────────────────
#     def label(self, txt):
#         self.flash_label = txt
#         self.flash_t     = time.time()
#         print(f"  ▶  {txt}")

#     def hotkey(self, txt, *keys):
#         self.last_cmd_t = time.time()
#         self.label(txt)
#         pyautogui.hotkey(*keys)

#     def swipe_hotkey(self, txt, *keys):
#         if time.time() - self.last_swipe_t < SWIPE_CD:
#             return
#         self.last_swipe_t = time.time()
#         self.label(txt)
#         pyautogui.hotkey(*keys)

#     def api(self, action, value=None):
#         now = time.time()
#         if now - self.last_cmd_t < COOLDOWN: return
#         self.last_cmd_t = now
#         self.label(action.replace("_"," ").upper())
#         try:
#             p = {"type": action}
#             if value is not None: p["value"] = value
#             requests.post(API, json=p, timeout=0.4)
#         except Exception as e:
#             print(f"[API ERR] {e}")

#     # ── space switching (THE FIX) ─────────────────────────────────────────────
#     def switch_space(self, direction: str):
#         """Switch macOS Mission Control space. direction: 'left' or 'right'"""
#         now = time.time()
#         if now - self.last_swipe_t < SWIPE_CD:
#             return
#         self.last_swipe_t = now
#         self.label(f"{'→ NEXT' if direction == 'right' else '← PREV'} SPACE")
#         send_ctrl_arrow(direction)

#     def switch_tab(self, direction: str):
#         """Switch browser tab. direction: 'left' or 'right'"""
#         now = time.time()
#         if now - self.last_swipe_t < SWIPE_CD:
#             return
#         self.last_swipe_t = now
#         self.label(f"{'→ NEXT' if direction == 'right' else '← PREV'} TAB")
#         send_ctrl_tab(direction)

#     # ── cursor mapping ────────────────────────────────────────────────────────
#     def lm_to_screen(self, lm):
#         raw_x = 1.0 - lm[8].x
#         raw_y = lm[8].y
#         M = 0.10
#         nx = max(0, min(1, (raw_x - M) / (1 - 2*M)))
#         ny = max(0, min(1, (raw_y - M) / (1 - 2*M)))
#         sx = int(self.fx(nx) * SCREEN_W)
#         sy = int(self.fy(ny) * SCREEN_H)
#         return sx, sy

#     # ── mouse mode handler ────────────────────────────────────────────────────
#     def do_mouse(self, lm, shape, now):
#         sx, sy = self.lm_to_screen(lm)

#         if shape == "point":
#             if self.dragging: pyautogui.mouseUp(); self.dragging = False
#             pyautogui.moveTo(sx, sy)
#             pinch = self.d(lm[4], lm[8])
#             if pinch < 0.042:
#                 if self.pinch_open:
#                     gap = now - self.last_click_t
#                     if 0 < gap < DBL_CLICK_WIN:
#                         pyautogui.click()
#                         pyautogui.click()
#                         self.label("DOUBLE CLICK")
#                     else:
#                         pyautogui.click()
#                         self.label("CLICK ✓")
#                     self.last_click_t = now
#                     self.pinch_open = False
#             else:
#                 self.pinch_open = True
#             return "MOVE CURSOR"

#         elif shape == "peace":
#             pyautogui.moveTo(sx, sy)
#             now_y = self.scroll_fy(lm[9].y)
#             if self.scroll_sy is not None:
#                 dy = now_y - self.scroll_sy
#                 dt = now - self.scroll_last
#                 if abs(dy) > 0.001 and dt > 0.02:
#                     self.scroll_accum += dy
#                     if abs(self.scroll_accum) > 0.006:
#                         raw = self.scroll_accum * 80
#                         amt = int(raw)
#                         if abs(amt) >= 1:
#                             clipped = max(-6, min(6, amt))
#                             pyautogui.scroll(-clipped)
#                             self.scroll_accum -= clipped / 80
#                             self.scroll_last = now
#                             self.label("SCROLL")
#             self.scroll_sy = now_y

#         elif shape == "fist":
#             if not self.dragging:
#                 pyautogui.mouseDown(); self.dragging = True
#             pyautogui.moveTo(sx, sy)
#             return "DRAGGING ✊"

#         elif shape == "three":
#             pyautogui.moveTo(sx, sy)
#             if self.hold_shape == "three":
#                 if now - self.hold_t > 0.35:
#                     pyautogui.rightClick(sx, sy)
#                     self.hold_shape = None
#                     self.label("RIGHT CLICK")
#             else:
#                 self.hold_shape = "three"
#                 self.hold_t     = now
#             return "RIGHT CLICK (hold)"

#         else:
#             if self.dragging: pyautogui.mouseUp(); self.dragging = False
#             return None

#     # ── command mode handler ──────────────────────────────────────────────────
#     def do_command(self, lm, shape, now):
#         held = self.check_hold(shape, now)

#         if held == "pinky":
#             self.hist.clear()
#             self.hotkey("SCREENSHOT", "command", "shift", "3")
#             return "screenshot"

#         # Swipes have their own last_swipe_t cooldown — not blocked by last_cmd_t
#         s = self.swipe("open_palm")
#         if s:
#             self.hist.clear()
#             self.switch_tab("right" if s == "R" else "left")
#             return "tab"

#         s = self.swipe("fist")
#         if s:
#             self.hist.clear()
#             self.switch_space("right" if s == "R" else "left")
#             return "space"

#         s = self.swipe("three")
#         if s:
#             self.hist.clear()
#             self.api("next_track" if s == "R" else "previous_track")
#             return "track"

#         return None

#     # ── per-frame logic ───────────────────────────────────────────────────────
#     def process(self, lm, now):
#         shape = self.classify(lm)
#         self.hist.append({"shape": shape, "x": lm[9].x, "y": lm[9].y, "t": now})
#         self.hist = [h for h in self.hist if now - h["t"] < 1.2]
#         self._prev_shape = shape

#         if not self.mouse_mode and self.stable(win=5) == "point":
#             self.mouse_mode = True
#             self.label("MOUSE MODE ON")

#         elif shape == "open_palm" and self.mouse_mode:
#             self.mouse_mode = False
#             if self.dragging: pyautogui.mouseUp(); self.dragging = False
#             self.label("COMMAND MODE")

#         if self.mouse_mode:
#             status = self.do_mouse(lm, shape, now)
#             return shape, status
#         else:
#             action = self.do_command(lm, shape, now)
#             return shape, action

#     # ── HUD ───────────────────────────────────────────────────────────────────
#     def draw_hud(self, frame, shape, lm_full, hold_prog):
#         h, w = frame.shape[:2]
#         now  = time.time()
#         icon = GESTURE_ICONS.get(shape, "❓")

#         ovl = frame.copy()
#         for y in range(0, h, 3): cv2.line(ovl,(0,y),(w,y),(0,0,0),1)
#         cv2.addWeighted(ovl, 0.07, frame, 0.93, 0, frame)

#         for (cx,cy),(dx,dy) in zip([(6,6),(w-6,6),(6,h-6),(w-6,h-6)],
#                                     [(1,1),(-1,1),(1,-1),(-1,-1)]):
#             cv2.line(frame,(cx,cy),(cx+dx*14,cy),CYAN,1)
#             cv2.line(frame,(cx,cy),(cx,cy+dy*14),CYAN,1)

#         cv2.rectangle(frame,(0,0),(w,20),(0,0,0),-1)
#         cv2.line(frame,(0,20),(w,20),CYAN,1)
#         mode_str = " [MOUSE]" if self.mouse_mode else " [CMD]"
#         cv2.putText(frame,f"JARVIS{mode_str}",(5,14),
#                     cv2.FONT_HERSHEY_SIMPLEX,0.38,
#                     ORANGE if self.mouse_mode else CYAN,1,cv2.LINE_AA)
#         cv2.putText(frame,f"{self.fps}fps",(w-38,14),
#                     cv2.FONT_HERSHEY_SIMPLEX,0.32,DIM,1,cv2.LINE_AA)

#         cv2.putText(frame,icon,(w//2-10,60),
#                     cv2.FONT_HERSHEY_SIMPLEX,0.9,WHITE,2,cv2.LINE_AA)

#         scol = GREEN if shape != "unknown" else DIM
#         cv2.putText(frame,shape.upper().replace("_"," "),(5,h-22),
#                     cv2.FONT_HERSHEY_SIMPLEX,0.38,scol,1,cv2.LINE_AA)

#         if hold_prog > 0 and lm_full:
#             cx2 = int(lm_full[0].x * w)
#             cy2 = int(lm_full[0].y * h)
#             cv2.ellipse(frame,(cx2,cy2),(20,20),-90,0,
#                         int(360*hold_prog),ORANGE,2,cv2.LINE_AA)

#         if self.mouse_mode and lm_full and shape in ("point","peace","fist","three"):
#             ix = int((1.0-lm_full[8].x)*w)
#             iy = int(lm_full[8].y*h)
#             cv2.drawMarker(frame,(ix,iy),ORANGE,cv2.MARKER_CROSS,12,1)

#         if now - self.flash_t < 1.1:
#             alpha = max(0.0, 1.0-(now-self.flash_t)/1.1)
#             sz = cv2.getTextSize(self.flash_label,cv2.FONT_HERSHEY_SIMPLEX,0.55,2)[0]
#             tx = (w-sz[0])//2
#             ty = h//2+8
#             cv2.rectangle(frame,(tx-5,ty-17),(tx+sz[0]+5,ty+5),(0,0,0),-1)
#             cv2.putText(frame,self.flash_label,(tx,ty),
#                         cv2.FONT_HERSHEY_SIMPLEX,0.55,
#                         tuple(int(c*alpha) for c in ORANGE),2,cv2.LINE_AA)

#         cv2.line(frame,(0,h-16),(w,h-16),CYAN,1)
#         cv2.rectangle(frame,(0,h-16),(w,h),(0,0,0),-1)
#         elapsed = time.time()-self.last_cmd_t
#         bw = int(w*min(1.0, elapsed/COOLDOWN))
#         cv2.rectangle(frame,(0,h-3),(bw,h),GREEN,-1)

#         cmd_tips = [
#             ("🖐", "palm →","tab sw"),
#             ("✊", "fist →","space sw"),
#             ("🤟", "three→","track"),
#             ("🤙", "hold →","screenshot"),
#         ]
#         mouse_tips = [
#             ("☝", "→ cursor", ""),
#             ("☝", "pinch→", "clk/dbl"),
#             ("✌", "palm↑↓→", "scroll"),
#             ("✊", "→ drag", ""),
#             ("🤟", "hold→", "r-clk"),
#             ("🖐", "→ exit", ""),
#         ]
#         tips = mouse_tips if self.mouse_mode else cmd_tips
#         col = ORANGE if self.mouse_mode else DIM
#         for i, t in enumerate(tips):
#             cv2.putText(frame,f"{t[0]} {t[1]} {t[2]}",(w-155,28+i*17),
#                         cv2.FONT_HERSHEY_SIMPLEX,0.25,col,1,cv2.LINE_AA)

#     # ── main loop ─────────────────────────────────────────────────────────────
#     def run(self):
#         kb_method = "pynput ✓" if PYNPUT_KB else "AppleScript ✓"
#         print(f"\n  ██  JARVIS GESTURE ENGINE — ONLINE  ██")
#         print(f"  Key sender: {kb_method}\n")
#         print("  🎮 COMMAND MODE")
#         print("    🖐 palm swipe  → switch tab  (cmd+opt+arrow)")
#         print("    ✊ fist swipe   → switch space (ctrl+arrow)")
#         print("    🤟 three swipe → tracks")
#         print("    🤙 hold         → screenshot\n")
#         print("  🖱 MOUSE MODE  (☝ point to enter)")
#         print("    ☝ point      → move cursor")
#         print("    ☝ thumb pinch→ click / double-click")
#         print("    ✌ palm↑↓     → scroll")
#         print("    ✊ fist       → drag")
#         print("    🤟 hold       → right-click")
#         print("    🖐 palm      → exit mouse\n")
#         print("  💡 If space switch still fails:")
#         print("     System Settings → Privacy & Security → Accessibility")
#         print("     Add Terminal (or your Python app) to the list\n")
#         print("  Press Q in the JARVIS window to quit.\n")

#         while True:
#             ret, frame = self.cap.read()
#             if not ret: continue

#             frame = cv2.flip(frame, 1)
#             now   = time.time()

#             self.fcount += 1
#             if now - self.ftimer >= 1.0:
#                 self.fps    = self.fcount
#                 self.fcount = 0
#                 self.ftimer = now

#             rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#             results = self.detector.process(rgb)

#             shape = "unknown"
#             lm    = None
#             hold_progress = 0.0

#             if results.multi_hand_landmarks:
#                 hand = results.multi_hand_landmarks[0]
#                 lm   = hand.landmark

#                 mp_drawing.draw_landmarks(
#                     frame, hand, mp_hands.HAND_CONNECTIONS,
#                     mp_drawing.DrawingSpec(color=GREEN, thickness=1, circle_radius=2),
#                     mp_drawing.DrawingSpec(color=CYAN,  thickness=1),
#                 )

#                 shape, _ = self.process(lm, now)

#                 if self.hold_shape and now - self.hold_t < HOLD_SEC * 2:
#                     hold_progress = min(1.0, (now-self.hold_t)/HOLD_SEC)

#             small = cv2.resize(frame, (self.WIN_W, self.WIN_H))
#             self.draw_hud(small, shape, lm, hold_progress)
#             cv2.imshow("JARVIS", small)

#             if cv2.waitKey(1) & 0xFF == ord('q'):
#                 break

#         self.cap.release()
#         cv2.destroyAllWindows()
#         print("\n  JARVIS offline.\n")


# if __name__ == "__main__":
#     Jarvis().run()

import cv2
import mediapipe as mp
import requests
import time
import math
import pyautogui
import threading
import subprocess
import os

try:
    import Quartz
    import CoreFoundation
    _SW_PT_DELTA_AXIS1 = 0
    _SW_PT_DELTA_AXIS2 = 1
    _SW_SCROLL_PHASE   = 99
    _SW_IS_CONTINUOUS  = 6
    _PH_BEGAN    = 1
    _PH_CHANGED  = 2
    _PH_ENDED    = 4
    _PH_MAY_BEGIN = 128
    QUARTZ_OK = True
except ImportError:
    QUARTZ_OK = False

try:
    from pynput.mouse import Listener as PynputMouse
    PYNPUT_OK = True
except ImportError:
    PYNPUT_OK = False

# ── Try to import pynput keyboard for reliable key sending ───────────────────
try:
    from pynput.keyboard import Key, Controller as KeyController
    _kb = KeyController()
    PYNPUT_KB = True
except ImportError:
    PYNPUT_KB = False

TOUCHPAD_AVAILABLE = QUARTZ_OK or PYNPUT_OK

pyautogui.FAILSAFE = False
pyautogui.PAUSE    = 0

API        = "http://localhost:3001/api/gesture"
mp_hands   = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

# HUD colors (BGR)
CYAN   = (255, 220,   0)
ORANGE = (  0, 140, 255)
GREEN  = (  0, 255, 150)
RED    = (  0,  60, 255)
DIM    = ( 55,  55,  55)
WHITE  = (230, 230, 230)

COOLDOWN   = 0.75
SWIPE_CD   = 0.80
HOLD_SEC   = 0.55
DBL_CLICK_WIN = 0.50
SWIPE_H_THRESH = 4

GESTURE_ICONS = {
    "point":     "☝️",
    "peace":     "✌️",
    "fist":      "✊",
    "three":     "🤟",
    "open_palm": "🖐️",
    "pinky":     "🤙",
    "unknown":   "❓",
}

SCREEN_W, SCREEN_H = pyautogui.size()


# ─────────────────────────────────────────────────────────────────────────────
# KEY SENDER — the single source of truth for sending keys on macOS
# Uses pynput if available (most reliable), falls back to AppleScript, then pyautogui
# ─────────────────────────────────────────────────────────────────────────────

def send_ctrl_arrow(direction: str):
    """Send Ctrl+Left or Ctrl+Right arrow for Mission Control space switching."""
    # Method 1: pynput (most reliable, bypasses focus issues)
    if PYNPUT_KB:
        try:
            with _kb.pressed(Key.ctrl):
                _kb.press(Key.right if direction == "right" else Key.left)
                _kb.release(Key.right if direction == "right" else Key.left)
            return
        except Exception as e:
            print(f"[KEY] pynput failed: {e}")

    # Method 2: AppleScript
    keycode = 124 if direction == "right" else 123
    script = f"""tell application "System Events" to key code {keycode} using {{control down}}"""
    try:
        subprocess.run(["osascript", "-e", script], timeout=1, capture_output=True)
        return
    except Exception as e:
        print(f"[KEY] AppleScript failed: {e}")

    # Method 3: pyautogui fallback
    try:
        pyautogui.hotkey("ctrl", "right" if direction == "right" else "left")
    except Exception as e:
        print(f"[KEY] pyautogui fallback failed: {e}")


def send_ctrl_tab(direction: str):
    """Send Cmd+Option+Right/Left for tab switching in browsers."""
    if PYNPUT_KB:
        try:
            with _kb.pressed(Key.cmd):
                with _kb.pressed(Key.alt):
                    _kb.press(Key.right if direction == "right" else Key.left)
                    _kb.release(Key.right if direction == "right" else Key.left)
            return
        except Exception as e:
            print(f"[KEY] pynput tab failed: {e}")

    keycode = 124 if direction == "right" else 123
    script = f"""tell application "System Events" to key code {keycode} using {{command down, option down}}"""
    try:
        subprocess.run(["osascript", "-e", script], timeout=1, capture_output=True)
        return
    except Exception as e:
        print(f"[KEY] AppleScript tab failed: {e}")

    try:
        pyautogui.hotkey("command", "option", "right" if direction == "right" else "left")
    except Exception as e:
        print(f"[KEY] pyautogui tab fallback failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# One-Euro adaptive filter
# ─────────────────────────────────────────────────────────────────────────────
class OneEuro:
    def __init__(self, mincutoff=1.2, beta=0.006):
        self.mc  = mincutoff
        self.b   = beta
        self.xp  = None
        self.dxp = 0.0
        self.tp  = None

    def _a(self, cutoff, dt):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def __call__(self, x):
        now = time.time()
        if self.xp is None:
            self.xp, self.tp = x, now
            return x
        dt   = max(now - self.tp, 1e-6)
        self.tp = now
        dx   = (x - self.xp) / dt
        adx  = self._a(1.0, dt)
        dxh  = adx * dx + (1 - adx) * self.dxp
        cut  = self.mc + self.b * abs(dxh)
        a    = self._a(cut, dt)
        xh   = a * x + (1 - a) * self.xp
        self.xp, self.dxp = xh, dxh
        return xh


# ─────────────────────────────────────────────────────────────────────────────
# Mac Trackpad listener (2-finger swipe → spaces)
# ─────────────────────────────────────────────────────────────────────────────
class TrackpadListener:
    _jarvis = None
    _h_delta = 0
    _v_delta = 0
    _active = False
    _suppress = False

    @classmethod
    def start(cls, jarvis):
        if not TOUCHPAD_AVAILABLE:
            print("  🔘 Install pynput for touchpad: pip install pynput")
            return
        cls._jarvis = jarvis
        if QUARTZ_OK:
            t = threading.Thread(target=cls._start_quartz, daemon=True)
            t.start()
        elif PYNPUT_OK:
            cls._run_pynput()

    @classmethod
    def _start_quartz(cls):
        kCGEventGesture = 29
        kCGEventSwipe   = 31
        mask = (Quartz.CGEventMaskBit(Quartz.kCGEventScrollWheel) |
                Quartz.CGEventMaskBit(kCGEventGesture) |
                Quartz.CGEventMaskBit(kCGEventSwipe))
        H_SUPPRESS_DIST = 4

        def handler(proxy, etype, event, refcon):
            try:
                if etype == Quartz.kCGEventScrollWheel:
                    phase = Quartz.CGEventGetIntegerValueField(event, _SW_SCROLL_PHASE)
                    if phase == 0:
                        return event  # let normal scroll through

                    dx = Quartz.CGEventGetIntegerValueField(event, _SW_PT_DELTA_AXIS1)
                    dy = Quartz.CGEventGetIntegerValueField(event, _SW_PT_DELTA_AXIS2)

                    if phase == _PH_BEGAN:
                        cls._h_delta = 0
                        cls._v_delta = 0
                        cls._active = True
                        cls._suppress = False
                        return None  # suppress the began event (prevents initial scroll jump)

                    elif phase == _PH_CHANGED and cls._active:
                        cls._h_delta += dx
                        cls._v_delta += dy
                        # Only mark for suppression if we're actually going horizontal
                        if abs(cls._h_delta) >= H_SUPPRESS_DIST and abs(cls._v_delta) < abs(cls._h_delta) * 0.6:
                            cls._suppress = True
                            return None  # suppress — this is a gesture swipe
                        # Otherwise let the scroll through (normal vertical scrolling)
                        return event

                    elif phase == _PH_ENDED and cls._active:
                        cls._active = False
                        fired = cls._check_swipe()  # returns True if swipe actually fired
                        # Only suppress if we actually consumed the gesture
                        if cls._suppress or fired:
                            return None
                        return event  # let it through if it was just a normal scroll

                    elif phase == _PH_MAY_BEGIN:
                        cls._active = False
                        cls._suppress = False

                elif etype in (kCGEventGesture, kCGEventSwipe):
                    dx = Quartz.CGEventGetIntegerValueField(event, _SW_PT_DELTA_AXIS1)
                    dy = Quartz.CGEventGetIntegerValueField(event, _SW_PT_DELTA_AXIS2)
                    if abs(dx) >= SWIPE_H_THRESH:
                        TrackpadListener._fire("swipe_h", "R" if dx > 0 else "L")
                        return None
            except Exception:
                pass
            return event

    @classmethod
    def _run_pynput(cls):
        def on_scroll(x, y, dx, dy):
            if abs(dx) > abs(dy) and abs(dx) > 1:
                TrackpadListener._fire("swipe_h", "R" if dx > 0 else "L")
            return True
        try:
            with PynputMouse(on_scroll=on_scroll) as listener:
                print("[TOUCHPAD] Listener active (pynput)")
                listener.join()
        except Exception as e:
            print(f"[TOUCHPAD] pynput error: {e}")

    @classmethod
    def _check_swipe(cls):
        h, v = cls._h_delta, cls._v_delta
        if abs(h) >= SWIPE_H_THRESH and abs(v) < abs(h) * 0.6:
            cls._fire("swipe_h", "R" if h > 0 else "L")

    @classmethod
    def _fire(cls, kind, direction):
        if not cls._jarvis:
            return
        j = cls._jarvis
        now = time.time()
        if now - j.last_swipe_t < SWIPE_CD:
            return
        j.last_swipe_t = now

        if kind == "swipe_h":
            if direction == "R":
                j.label("NEXT SPACE →")
                send_ctrl_arrow("right")
            else:
                j.label("← PREV SPACE")
                send_ctrl_arrow("left")


# ─────────────────────────────────────────────────────────────────────────────
class Jarvis:
    def __init__(self):
        self.detector = mp_hands.Hands(
            max_num_hands=1, model_complexity=1,
            min_detection_confidence=0.78,
            min_tracking_confidence=0.78,
        )
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        self.WIN_W, self.WIN_H = 340, 260
        # NO WINDOW — runs fully in background, never steals focus

        self.hist          = []
        self.last_cmd_t    = 0
        self.hold_shape    = None
        self.hold_t        = 0
        self.flash_label   = ""
        self.flash_t       = 0

        self.mouse_mode    = False
        self.dragging      = False
        self.pinch_open    = True
        self.last_click_t  = 0
        self.last_scroll_t = 0
        self.fx            = OneEuro(mincutoff=2.0, beta=0.004)
        self.fy            = OneEuro(mincutoff=2.0, beta=0.004)

        self.last_swipe_t  = 0
        self._prev_shape   = None

        self.scroll_fy     = OneEuro(mincutoff=1.5, beta=0.03)
        self.scroll_sy     = None
        self.scroll_last   = 0
        self.scroll_accum  = 0.0

        self.fps     = 0
        self.fcount  = 0
        self.ftimer  = time.time()

        # Graceful shutdown flag
        self.running = True

        # Background 'q' listener since there's no cv2 window
        if PYNPUT_KB:
            from pynput.keyboard import Listener
            def _on_press(key):
                if hasattr(key, 'char') and key.char == 'q':
                    self.running = False
                    return False
            def _kb_thread():
                with Listener(on_press=_on_press) as lst:
                    lst.join()
            threading.Thread(target=_kb_thread, daemon=True).start()

        TrackpadListener.start(self)

    # ── geometry ─────────────────────────────────────────────────────────────
    def d(self, a, b):
        return math.hypot(a.x - b.x, a.y - b.y)

    def ext(self, lm, tip, pip):
        return self.d(lm[tip], lm[0]) > self.d(lm[pip], lm[0]) * 0.92

    def classify(self, lm):
        i = self.ext(lm,  8,  6)
        m = self.ext(lm, 12, 10)
        r = self.ext(lm, 16, 14)
        p = self.ext(lm, 20, 18)
        n = i + m + r + p
        tt, ip, wr = lm[4], lm[3], lm[0]

        if n == 0:
            if tt.y < ip.y - 0.02 and tt.y < wr.y: return "thumb_up"
            if tt.y > ip.y + 0.02 and tt.y > wr.y: return "thumb_down"
            return "fist"
        if n == 4: return "open_palm"
        if i and m and r and not p: return "three"
        if i and m and not r and not p: return "peace"
        if i and not m and not r and not p: return "point"
        if not i and not m and not r and p: return "pinky"
        return "unknown"

    def stable(self, win=6):
        if len(self.hist) < win: return "unknown"
        c = {}
        for h in self.hist[-win:]: c[h["shape"]] = c.get(h["shape"], 0) + 1
        best = max(c, key=c.get)
        return best if c[best] >= win * 0.6 else "unknown"

    def swipe(self, shape, min_dx=0.03, max_dy=0.30, ms=1200):
        if len(self.hist) < 3: return None
        recent = self.hist[-3:]
        if recent[-1]["shape"] != shape: return None
        if sum(1 for h in recent if h["shape"] == shape) < 2: return None
        r  = self.hist[-3:]
        dx = r[-1]["x"] - r[0]["x"]
        dy = r[-1]["y"] - r[0]["y"]
        dt = (r[-1]["t"] - r[0]["t"]) * 1000
        if abs(dy) > max_dy: return None
        if abs(dx) < min_dx: return None
        if dt > ms:          return None
        return "R" if dx > 0 else "L"

    def check_hold(self, shape, now):
        if shape in ("pinky",):
            if self.hold_shape == shape:
                if now - self.hold_t >= HOLD_SEC:
                    self.hold_shape = None
                    return shape
            else:
                self.hold_shape = shape
                self.hold_t     = now
        else:
            self.hold_shape = None
        return None

    # ── action firing ─────────────────────────────────────────────────────────
    def label(self, txt):
        self.flash_label = txt
        self.flash_t     = time.time()
        print(f"  ▶  {txt}")

    def hotkey(self, txt, *keys):
        self.last_cmd_t = time.time()
        self.label(txt)
        pyautogui.hotkey(*keys)

    def swipe_hotkey(self, txt, *keys):
        if time.time() - self.last_swipe_t < SWIPE_CD:
            return
        self.last_swipe_t = time.time()
        self.label(txt)
        pyautogui.hotkey(*keys)

    def api(self, action, value=None):
        now = time.time()
        if now - self.last_cmd_t < COOLDOWN: return
        self.last_cmd_t = now
        self.label(action.replace("_"," ").upper())
        try:
            p = {"type": action}
            if value is not None: p["value"] = value
            requests.post(API, json=p, timeout=0.4)
        except Exception as e:
            print(f"[API ERR] {e}")

    # ── space switching (THE FIX) ─────────────────────────────────────────────
    def switch_space(self, direction: str):
        """Switch macOS Mission Control space. direction: 'left' or 'right'"""
        now = time.time()
        if now - self.last_swipe_t < SWIPE_CD:
            return
        self.last_swipe_t = now
        self.label(f"{'→ NEXT' if direction == 'right' else '← PREV'} SPACE")
        send_ctrl_arrow(direction)

    def switch_tab(self, direction: str):
        """Switch browser tab. direction: 'left' or 'right'"""
        now = time.time()
        if now - self.last_swipe_t < SWIPE_CD:
            return
        self.last_swipe_t = now
        self.label(f"{'→ NEXT' if direction == 'right' else '← PREV'} TAB")
        send_ctrl_tab(direction)

    # ── cursor mapping ────────────────────────────────────────────────────────
    def lm_to_screen(self, lm):
        raw_x = 1.0 - lm[8].x
        raw_y = lm[8].y
        M = 0.10
        nx = max(0, min(1, (raw_x - M) / (1 - 2*M)))
        ny = max(0, min(1, (raw_y - M) / (1 - 2*M)))
        sx = int(self.fx(nx) * SCREEN_W)
        sy = int(self.fy(ny) * SCREEN_H)
        return sx, sy

    # ── mouse mode handler ────────────────────────────────────────────────────
    def do_mouse(self, lm, shape, now):
        sx, sy = self.lm_to_screen(lm)

        if shape == "point":
            if self.dragging: pyautogui.mouseUp(); self.dragging = False
            pyautogui.moveTo(sx, sy)
            pinch = self.d(lm[4], lm[8])
            if pinch < 0.042:
                if self.pinch_open:
                    gap = now - self.last_click_t
                    if 0 < gap < DBL_CLICK_WIN:
                        pyautogui.click()
                        pyautogui.click()
                        self.label("DOUBLE CLICK")
                    else:
                        pyautogui.click()
                        self.label("CLICK ✓")
                    self.last_click_t = now
                    self.pinch_open = False
            else:
                self.pinch_open = True
            return "MOVE CURSOR"

        elif shape == "peace":
            pyautogui.moveTo(sx, sy)
            now_y = self.scroll_fy(lm[9].y)
            if self.scroll_sy is not None:
                dy = now_y - self.scroll_sy
                dt = now - self.scroll_last
                if abs(dy) > 0.001 and dt > 0.02:
                    self.scroll_accum += dy
                    if abs(self.scroll_accum) > 0.006:
                        raw = self.scroll_accum * 80
                        amt = int(raw)
                        if abs(amt) >= 1:
                            clipped = max(-6, min(6, amt))
                            pyautogui.scroll(-clipped)
                            self.scroll_accum -= clipped / 80
                            self.scroll_last = now
                            self.label("SCROLL")
            self.scroll_sy = now_y

        elif shape == "fist":
            if not self.dragging:
                pyautogui.mouseDown(); self.dragging = True
            pyautogui.moveTo(sx, sy)
            return "DRAGGING ✊"

        elif shape == "three":
            pyautogui.moveTo(sx, sy)
            if self.hold_shape == "three":
                if now - self.hold_t > 0.35:
                    pyautogui.rightClick(sx, sy)
                    self.hold_shape = None
                    self.label("RIGHT CLICK")
            else:
                self.hold_shape = "three"
                self.hold_t     = now
            return "RIGHT CLICK (hold)"

        else:
            if self.dragging: pyautogui.mouseUp(); self.dragging = False
            return None

    # ── command mode handler ──────────────────────────────────────────────────
    def do_command(self, lm, shape, now):
        held = self.check_hold(shape, now)

        if held == "pinky":
            self.hist.clear()
            self.hotkey("SCREENSHOT", "command", "shift", "3")
            return "screenshot"

        s = self.swipe("open_palm")
        if s:
            self.hist.clear()
            self.switch_tab("right" if s == "R" else "left")
            return "tab"

        s = self.swipe("fist")
        if s:
            self.hist.clear()
            self.switch_space("right" if s == "R" else "left")
            return "space"

        s = self.swipe("three")
        if s:
            self.hist.clear()
            self.api("next_track" if s == "R" else "previous_track")
            return "track"

        return None

    # ── per-frame logic ───────────────────────────────────────────────────────
    def process(self, lm, now):
        shape = self.classify(lm)
        self.hist.append({"shape": shape, "x": lm[9].x, "y": lm[9].y, "t": now})
        self.hist = [h for h in self.hist if now - h["t"] < 1.2]
        self._prev_shape = shape

        if not self.mouse_mode and self.stable(win=5) == "point":
            self.mouse_mode = True
            self.label("MOUSE MODE ON")

        elif shape == "open_palm" and self.mouse_mode:
            self.mouse_mode = False
            if self.dragging: pyautogui.mouseUp(); self.dragging = False
            self.label("COMMAND MODE")

        if self.mouse_mode:
            status = self.do_mouse(lm, shape, now)
            return shape, status
        else:
            action = self.do_command(lm, shape, now)
            return shape, action

    # ── HUD ───────────────────────────────────────────────────────────────────
    def draw_hud(self, frame, shape, lm_full, hold_prog):
        h, w = frame.shape[:2]
        now  = time.time()
        icon = GESTURE_ICONS.get(shape, "❓")

        ovl = frame.copy()
        for y in range(0, h, 3): cv2.line(ovl,(0,y),(w,y),(0,0,0),1)
        cv2.addWeighted(ovl, 0.07, frame, 0.93, 0, frame)

        for (cx,cy),(dx,dy) in zip([(6,6),(w-6,6),(6,h-6),(w-6,h-6)],
                                    [(1,1),(-1,1),(1,-1),(-1,-1)]):
            cv2.line(frame,(cx,cy),(cx+dx*14,cy),CYAN,1)
            cv2.line(frame,(cx,cy),(cx,cy+dy*14),CYAN,1)

        cv2.rectangle(frame,(0,0),(w,20),(0,0,0),-1)
        cv2.line(frame,(0,20),(w,20),CYAN,1)
        mode_str = " [MOUSE]" if self.mouse_mode else " [CMD]"
        cv2.putText(frame,f"JARVIS{mode_str}",(5,14),
                    cv2.FONT_HERSHEY_SIMPLEX,0.38,
                    ORANGE if self.mouse_mode else CYAN,1,cv2.LINE_AA)
        cv2.putText(frame,f"{self.fps}fps",(w-38,14),
                    cv2.FONT_HERSHEY_SIMPLEX,0.32,DIM,1,cv2.LINE_AA)

        cv2.putText(frame,icon,(w//2-10,60),
                    cv2.FONT_HERSHEY_SIMPLEX,0.9,WHITE,2,cv2.LINE_AA)

        scol = GREEN if shape != "unknown" else DIM
        cv2.putText(frame,shape.upper().replace("_"," "),(5,h-22),
                    cv2.FONT_HERSHEY_SIMPLEX,0.38,scol,1,cv2.LINE_AA)

        if hold_prog > 0 and lm_full:
            cx2 = int(lm_full[0].x * w)
            cy2 = int(lm_full[0].y * h)
            cv2.ellipse(frame,(cx2,cy2),(20,20),-90,0,
                        int(360*hold_prog),ORANGE,2,cv2.LINE_AA)

        if self.mouse_mode and lm_full and shape in ("point","peace","fist","three"):
            ix = int((1.0-lm_full[8].x)*w)
            iy = int(lm_full[8].y*h)
            cv2.drawMarker(frame,(ix,iy),ORANGE,cv2.MARKER_CROSS,12,1)

        if now - self.flash_t < 1.1:
            alpha = max(0.0, 1.0-(now-self.flash_t)/1.1)
            sz = cv2.getTextSize(self.flash_label,cv2.FONT_HERSHEY_SIMPLEX,0.55,2)[0]
            tx = (w-sz[0])//2
            ty = h//2+8
            cv2.rectangle(frame,(tx-5,ty-17),(tx+sz[0]+5,ty+5),(0,0,0),-1)
            cv2.putText(frame,self.flash_label,(tx,ty),
                        cv2.FONT_HERSHEY_SIMPLEX,0.55,
                        tuple(int(c*alpha) for c in ORANGE),2,cv2.LINE_AA)

        cv2.line(frame,(0,h-16),(w,h-16),CYAN,1)
        cv2.rectangle(frame,(0,h-16),(w,h),(0,0,0),-1)
        elapsed = time.time()-self.last_cmd_t
        bw = int(w*min(1.0, elapsed/COOLDOWN))
        cv2.rectangle(frame,(0,h-3),(bw,h),GREEN,-1)

        cmd_tips = [
            ("🖐", "palm →","tab sw"),
            ("✊", "fist →","space sw"),
            ("🤟", "three→","track"),
            ("🤙", "hold →","screenshot"),
        ]
        mouse_tips = [
            ("☝", "→ cursor", ""),
            ("☝", "pinch→", "clk/dbl"),
            ("✌", "palm↑↓→", "scroll"),
            ("✊", "→ drag", ""),
            ("🤟", "hold→", "r-clk"),
            ("🖐", "→ exit", ""),
        ]
        tips = mouse_tips if self.mouse_mode else cmd_tips
        col = ORANGE if self.mouse_mode else DIM
        for i, t in enumerate(tips):
            cv2.putText(frame,f"{t[0]} {t[1]} {t[2]}",(w-155,28+i*17),
                        cv2.FONT_HERSHEY_SIMPLEX,0.25,col,1,cv2.LINE_AA)

    # ── main loop ─────────────────────────────────────────────────────────────
    def run(self):
        kb_method = "pynput ✓" if PYNPUT_KB else "AppleScript ✓"
        print(f"\n  ██  JARVIS GESTURE ENGINE — ONLINE  ██")
        print(f"  Key sender: {kb_method}\n")
        print("  🎮 COMMAND MODE")
        print("    🖐 palm swipe  → switch tab  (cmd+opt+arrow)")
        print("    ✊ fist swipe   → switch space (ctrl+arrow)")
        print("    🤟 three swipe → tracks")
        print("    🤙 hold         → screenshot\n")
        print("  🖱 MOUSE MODE  (☝ point to enter)")
        print("    ☝ point      → move cursor")
        print("    ☝ thumb pinch→ click / double-click")
        print("    ✌ palm↑↓     → scroll")
        print("    ✊ fist       → drag")
        print("    🤟 hold       → right-click")
        print("    🖐 palm      → exit mouse\n")
        print("  💡 If space switch still fails:")
        print("     System Settings → Privacy & Security → Accessibility")
        print("     Add Terminal (or your Python app) to the list\n")
        print("  Press Q anywhere to quit.\n")

        while self.running:
            ret, frame = self.cap.read()
            if not ret: continue

            frame = cv2.flip(frame, 1)
            now   = time.time()

            self.fcount += 1
            if now - self.ftimer >= 1.0:
                self.fps    = self.fcount
                self.fcount = 0
                self.ftimer = now

            rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.detector.process(rgb)

            shape = "unknown"
            lm    = None
            hold_progress = 0.0

            if results.multi_hand_landmarks:
                hand = results.multi_hand_landmarks[0]
                lm   = hand.landmark

                mp_drawing.draw_landmarks(
                    frame, hand, mp_hands.HAND_CONNECTIONS,
                    mp_drawing.DrawingSpec(color=GREEN, thickness=1, circle_radius=2),
                    mp_drawing.DrawingSpec(color=CYAN,  thickness=1),
                )

                shape, _ = self.process(lm, now)

                if self.hold_shape and now - self.hold_t < HOLD_SEC * 2:
                    hold_progress = min(1.0, (now-self.hold_t)/HOLD_SEC)

            small = cv2.resize(frame, (self.WIN_W, self.WIN_H))
            self.draw_hud(small, shape, lm, hold_progress)

            # NO cv2.imshow — camera runs in background, no window, no focus steal

        self.cap.release()
        print("\n  JARVIS offline.\n")


if __name__ == "__main__":
    Jarvis().run()