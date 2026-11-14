"""Genera el logo de GymLog: una G en perspectiva isométrica (como una cinta doblada),
con acabado de rojo metalizado.

Uso:  python3 tools/logo.py <carpeta> [--rojo | --plata-rojo | --plata]  →  <carpeta>/logo-1024.png
"""
import sys, math, numpy as np
from PIL import Image, ImageDraw, ImageFilter

N, SS = 1024, 3          # tamaño final y sobremuestreo para bordes suaves
M = N * SS

def quads(pts, w):
    """Divide una línea quebrada de grosor w en un cuadrilátero por tramo, con uniones en inglete."""
    h = w / 2; n = len(pts)
    unit = lambda a, b: ((b[0]-a[0]) / math.hypot(b[0]-a[0], b[1]-a[1]), (b[1]-a[1]) / math.hypot(b[0]-a[0], b[1]-a[1]))
    dirs = [unit(pts[i], pts[i+1]) for i in range(n-1)]
    nrm = lambda d: (-d[1], d[0])
    L, R = [], []
    for i in range(n):
        if i in (0, n-1):
            nx, ny = nrm(dirs[0] if i == 0 else dirs[-1])
            L.append((pts[i][0]+nx*h, pts[i][1]+ny*h)); R.append((pts[i][0]-nx*h, pts[i][1]-ny*h))
        else:
            n1, n2 = nrm(dirs[i-1]), nrm(dirs[i]); mx, my = n1[0]+n2[0], n1[1]+n2[1]; ml = math.hypot(mx, my); mx, my = mx/ml, my/ml
            k = h / (mx*n1[0] + my*n1[1])
            L.append((pts[i][0]+mx*k, pts[i][1]+my*k)); R.append((pts[i][0]-mx*k, pts[i][1]-my*k))
    return [([L[i], L[i+1], R[i+1], R[i]], dirs[i]) for i in range(n-1)]

def s_curve(v):
    v = np.clip(v, 0, 1); return 0.5 - 0.5 * np.cos(np.pi * v)

def silver(v):
    lo, mid, hi = np.array([52, 54, 60]), np.array([168, 172, 180]), np.array([250, 251, 253]); v = v[..., None]
    return np.where(v < 0.55, lo + (mid-lo) * (v/0.55), mid + (hi-mid) * ((v-0.55)/0.45))

def redmetal(v):
    lo, mid, hi = np.array([48, 0, 0]), np.array([210, 10, 2]), np.array([255, 128, 104]); v = v[..., None]
    return np.where(v < 0.62, lo + (mid-lo) * (v/0.62), mid + (hi-mid) * ((v-0.62)/0.38))

def render(out_path, style='rojo'):
    """style: 'rojo' (todo rojo metálico), 'plata-rojo' (plata con travesaño rojo) o 'plata'."""
    yy, xx = np.mgrid[0:M, 0:M].astype(np.float32)
    def mask(poly):
        im = Image.new('L', (M, M), 0); ImageDraw.Draw(im).polygon(poly, fill=255); return np.asarray(im, np.float32) / 255
    # G sobre un hexágono con punta arriba: tramos a 30° como en un dibujo isométrico
    R, W = 330.0, 118.0
    c, s = math.cos(math.radians(30)), 0.5
    V = lambda a, b: (512 + a * R, 512 + b * R)
    pts = [V(c, -s), V(0, -1), V(-c, -s), V(-c, s), V(0, 1), V(c, s), V(c, 0.02), V(0.22, 0.02)]
    Q = quads([(x * SS, y * SS) for x, y in pts], W * SS)

    img = np.zeros((M, M, 3), np.float32); img[:] = 6 + (1 - yy / M)[..., None] * 22   # fondo negro con degradado
    allm = np.zeros((M, M), np.float32); faces = []
    for idx, (poly, d) in enumerate(Q):
        m = mask(poly); allm = np.maximum(allm, m)
        xs_ = [p[0] for p in poly]; ys_ = [p[1] for p in poly]
        u = ((xx - min(xs_)) / (max(xs_) - min(xs_) + 1e-6) + (yy - min(ys_)) / (max(ys_) - min(ys_) + 1e-6)) / 2
        if abs(d[0]) < 0.2:   base = 0.30   # tramo vertical: cara en sombra
        elif abs(d[1]) < 0.2: base = 0.55   # travesaño
        elif d[0] * d[1] > 0: base = 0.80   # orientación "\": la cara más iluminada
        else:                 base = 0.58   # orientación "/": cara intermedia
        v = base + 0.16 * np.cos(2 * np.pi * u + 0.8) + 0.06          # reflejo a lo largo de cada cara
        pal = redmetal if style == 'rojo' or (style == 'plata-rojo' and idx == len(Q) - 1) else silver
        faces.append((m, s_curve(v), pal))
    sh = Image.fromarray((allm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(26 * SS))   # sombra suave
    sh = np.roll(np.roll(np.asarray(sh, np.float32) / 255, 14 * SS, 0), 6 * SS, 1)[..., None]
    img *= (1 - 0.6 * sh)
    for m, v, pal in faces:
        a = m[..., None]; img = img * (1 - a) + pal(v) * a
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((N, N), Image.LANCZOS).save(out_path)

if __name__ == '__main__':
    style = next((a[2:] for a in sys.argv[2:] if a.startswith('--')), 'rojo')
    render(sys.argv[1].rstrip('/') + '/logo-1024.png', style)
