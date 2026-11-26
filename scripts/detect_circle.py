from PIL import Image, ImageDraw
import numpy as np

img_path = r'C:/Users/saipa/.gemini/antigravity/brain/26b8b048-6678-4b8c-83a5-6d250cdbd80f/.user_uploaded/media_1795679477757_3c217ccf.jpg'
img = Image.open(img_path).convert('RGB')
w, h = img.size
arr = np.array(img)

# The circular border has a distinct teal/dark turquoise color:
# Let's inspect along vertical and horizontal center lines to find the circle's outer edge.
cx, cy = w // 2, h // 2
print(f"Center approx: ({cx}, {cy})")

# Horizontal scan across cy
row = arr[cy]
teal_pixels_x = []
for x in range(w):
    r, g, b = [int(v) for v in row[x]]
    # Teal color roughly: r is lower, g and b are higher (e.g. r < 50, g > 120, b > 120)
    # Let's check distance to white (255, 255, 255)
    diff_from_white = (255 - r) + (255 - g) + (255 - b)
    if diff_from_white > 150: # colored pixel
        teal_pixels_x.append(x)

if teal_pixels_x:
    print(f"X bounds of colored circle: min={teal_pixels_x[0]}, max={teal_pixels_x[-1]}, width={teal_pixels_x[-1]-teal_pixels_x[0]}")

# Vertical scan across cx
col = arr[:, cx]
teal_pixels_y = []
for y in range(h):
    r, g, b = [int(v) for v in col[y]]
    diff_from_white = (255 - r) + (255 - g) + (255 - b)
    if diff_from_white > 150:
        teal_pixels_y.append(y)

if teal_pixels_y:
    print(f"Y bounds of colored circle: min={teal_pixels_y[0]}, max={teal_pixels_y[-1]}, height={teal_pixels_y[-1]-teal_pixels_y[0]}")
