from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

img_path = r'C:/Users/saipa/.gemini/antigravity/brain/26b8b048-6678-4b8c-83a5-6d250cdbd80f/.user_uploaded/media_1795679477757_3c217ccf.jpg'
orig = Image.open(img_path).convert('RGBA')
w, h = orig.size

# Let's find the circle center and radius accurately
# The circle outer boundary:
# Center cx=331, cy=330.5, radius ~ 304.5
cx, cy = 331.0, 330.5
radius = 304.5

# Let's inspect radial samples around the circle to find the exact radius where the teal circle drops off to white
radii = []
for angle_deg in range(0, 360, 5):
    rad = np.radians(angle_deg)
    # scan along ray from r=295 to r=315
    for r in np.linspace(295, 315, 41):
        x = int(cx + r * np.cos(rad))
        y = int(cy + r * np.sin(rad))
        if 0 <= x < w and 0 <= y < h:
            pixel = orig.getpixel((x, y))
            # Teal border has strong color (e.g. g > 100, b > 100, r < 100 or saturation)
            # When outside the border, background is white/near-white or shadow
            r_c, g_c, b_c, _ = pixel
            # check if colored (diff from white > 60)
            diff = (255 - r_c) + (255 - g_c) + (255 - b_c)
            # If shadow at bottom-left, r_c, g_c, b_c are greyish (low saturation)
            # Teal has g_c > r_c + 25 and b_c > r_c + 25
            is_teal = (g_c > r_c + 20) and (b_c > r_c + 20)
            if is_teal:
                last_teal_r = r
    radii.append(last_teal_r)

exact_r = np.median(radii) + 1.0  # encompass the entire teal ring
print(f"Computed circle center: ({cx}, {cy}), outer radius: {exact_r:.2f}")

# Supersample 4x for super-smooth antialiased circular cutout
scale = 4
big_w, big_h = w * scale, h * scale
big_img = orig.resize((big_w, big_h), Image.Resampling.LANCZOS)

# Create circular mask
mask = Image.new('L', (big_w, big_h), 0)
draw = ImageDraw.Draw(mask)
big_cx = cx * scale
big_cy = cy * scale
big_r = exact_r * scale

draw.ellipse([big_cx - big_r, big_cy - big_r, big_cx + big_r, big_cy + big_r], fill=255)

# Crop to the circle bounding box
bbox = [int(big_cx - big_r), int(big_cy - big_r), int(big_cx + big_r), int(big_cy + big_r)]
cropped_img = big_img.crop(bbox)
cropped_mask = mask.crop(bbox)

# Apply mask as alpha
cropped_img.putalpha(cropped_mask)

# Resize down with Lanczos to final crisp dimensions (e.g., 608x608)
final_size = int(exact_r * 2)
# Ensure square
final_logo = cropped_img.resize((final_size, final_size), Image.Resampling.LANCZOS)

os.makedirs('public/images', exist_ok=True)
final_logo.save('public/images/healvia-logo.png', format='PNG', optimize=True)
print("Saved public/images/healvia-logo.png size:", final_logo.size)

# Create icon-only variation: 128x128, 64x64, 32x32, 16x16 for favicon and compact headers
icon_128 = final_logo.resize((128, 128), Image.Resampling.LANCZOS)
icon_128.save('public/images/healvia-icon.png', format='PNG', optimize=True)

# Also create central symbol crop for micro favicon if needed
# The H symbol is in the upper 60% of the circle
h_symbol_box = (
    int(final_size * 0.18),
    int(final_size * 0.08),
    int(final_size * 0.82),
    int(final_size * 0.68)
)
h_symbol = final_logo.crop(h_symbol_box)
h_symbol_sq = Image.new('RGBA', (max(h_symbol.size), max(h_symbol.size)), (0, 0, 0, 0))
h_symbol_sq.paste(h_symbol, ((max(h_symbol.size) - h_symbol.width)//2, (max(h_symbol.size) - h_symbol.height)//2))
h_symbol_sq.resize((128, 128), Image.Resampling.LANCZOS).save('public/images/healvia-symbol.png', format='PNG')

# Save multi-size favicon.ico
final_logo.save('public/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
final_logo.save('src/app/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
final_logo.resize((32, 32), Image.Resampling.LANCZOS).save('public/favicon.png', format='PNG')

print("All logo and icon variations generated successfully!")
