# Genera el logo de la app (uso: python3 tools/logo.py <carpeta>) → metal-plata-rojo.png a 1024 px.
# Logo G curvada y metálica: se pinta píxel a píxel (con sobremuestreo) para simular reflejos de metal.
import sys, numpy as np
from PIL import Image, ImageFilter
OUT = sys.argv[1]
N = 1024; SS = 3; M = N * SS
y, x = np.mgrid[0:M, 0:M].astype(np.float32) / SS
cx, cy = 512.0, 512.0
R_out, W = 318.0, 118.0; R_in = R_out - W
dx, dy = x - cx, y - cy
b, rc = 318.0, 170.0                      # semilado y radio de esquina del cuadrado redondeado
qx, qy = np.abs(dx) - (b - rc), np.abs(dy) - (b - rc)
dist = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - rc
r = R_out + dist
ang = np.degrees(np.arctan2(dy, dx))          # 0 = derecha, -90 = arriba (pantalla)
A0 = -42.0                                    # empieza arriba a la derecha y gira por la izquierda hasta la derecha
sweep = (A0 - ang) % 360                      # 0..360 recorriendo la G en sentido antihorario
in_band = (r >= R_in) & (r <= R_out)
arc = in_band & (sweep <= 318.0)              # de -42° a 0°: 318° de recorrido
# Travesaño: banda horizontal que sale del final del arco hacia dentro, por encima de la línea media
bar_y0, bar_y1 = cy - W, cy
bar_x0, bar_x1 = cx + 30, cx + R_out
bar = (y >= bar_y0) & (y <= bar_y1) & (x >= bar_x0) & (x <= bar_x1)
# Doblez: en el cuadrado donde se unen arco y travesaño, la diagonal separa las dos caras
sq = bar & (x >= cx + R_in)
fold_bar = sq & ((x - (cx + R_in)) < ((cy) - y))          # triángulo superior-izquierdo → cara del travesaño
bar_face = (bar & ~sq) | fold_bar
arc_face = (arc & ~bar_face) | (sq & ~fold_bar)
t = np.clip((r - R_in) / W, 0, 1)                            # 0 borde interior → 1 borde exterior

def metal(v):  # v 0..1 → brillo con aspecto metálico (contraste en S)
    return np.clip(0.5 - 0.5 * np.cos(np.pi * np.clip(v, 0, 1)), 0, 1)
# Reflejo a lo largo de la curva: dos franjas de luz, como un aro de acero
th = np.radians(sweep)
v_arc = 0.30 + 0.55 * (0.5 + 0.5 * np.cos(2 * (th - 0.9))) + 0.12 * (1 - np.abs(2 * t - 1)) ** 2
v_arc = metal(v_arc)
# Cara del travesaño: degradado horizontal más oscuro (está doblada respecto al arco)
u = np.clip((x - bar_x0) / (bar_x1 - bar_x0), 0, 1)
v_bar = metal(0.25 + 0.45 * u + 0.08 * (1 - np.abs(2 * (y - bar_y0) / W - 1)))

def paint(pal_arc, pal_bar, name):
    img = np.zeros((M, M, 3), np.float32)
    g = (1 - y / M)[..., None]
    img[:] = np.array([6, 6, 6]) + g * np.array([22, 22, 22])                 # fondo negro con degradado
    # sombra suave de la letra sobre el fondo
    mask = (arc_face | bar_face).astype(np.float32)
    sh = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28 * SS))
    sh = np.roll(np.roll(np.asarray(sh, np.float32) / 255, 14 * SS, 0), 6 * SS, 1)[..., None]
    img *= (1 - 0.6 * sh)
    for face, v, pal in ((arc_face, v_arc, pal_arc), (bar_face, v_bar, pal_bar)):
        c = pal(v)
        img[face] = c[face]
    # filo: línea fina más clara en el borde exterior y más oscura en el interior (canto del metal)
    edge_o = arc_face & (r > R_out - 3.5)
    img[edge_o] = np.minimum(img[edge_o] * 1.35 + 20, 255)
    edge_i = arc_face & (r < R_in + 2.5)
    img[edge_i] *= 0.6
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((N, N), Image.LANCZOS)
    im.save(f'{OUT}/metal-{name}.png')

def silver(v):
    lo, mid, hi = np.array([58, 60, 66]), np.array([170, 174, 182]), np.array([250, 251, 253])
    v = v[..., None]
    return np.where(v < 0.55, lo + (mid - lo) * (v / 0.55), mid + (hi - mid) * ((v - 0.55) / 0.45))
def redmetal(v):
    lo, mid, hi = np.array([70, 0, 0]), np.array([215, 12, 4]), np.array([255, 150, 140])
    v = v[..., None]
    return np.where(v < 0.6, lo + (mid - lo) * (v / 0.6), mid + (hi - mid) * ((v - 0.6) / 0.4))

paint(silver, redmetal, 'plata-rojo')  # logo actual
