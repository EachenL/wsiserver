from io import BytesIO
import math
import argparse

from fastapi import FastAPI
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from PIL import Image
import openslide
from openslide.deepzoom import DeepZoomGenerator
import sys
sys.path.append('/Users/markning/Desktop/wsiserver/src')
import wsiserver
from typing import List
import os

parser = argparse.ArgumentParser()
parser.add_argument("wsi", type=str, help="path to the WSI to load")
parser.add_argument("--host", type=str, default="0.0.0.0", help="host to listen on")
parser.add_argument("--port", type=int, default=31791, help="port to listen on")
parser.add_argument("--tile_size", type=int, default=256, help="tile size")
parser.add_argument("--version", "-v", action="version", version=wsiserver.__version__)
args = parser.parse_args([r'/Volumes/My Passport/B127/1-4-2_肝细胞坏死__-_40x/1-4-2_肝细胞坏死__-_40x.ndpi'])

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)
dzg = DeepZoomGenerator(
    openslide.OpenSlide(args.wsi),
    tile_size=args.tile_size,
    overlap=0,
    limit_bounds=False)
max_zoom = dzg.level_count - 1
min_zoom = int(max_zoom - math.log2(max(dzg.level_dimensions[-1])/args.tile_size))
default_zoom = min_zoom + 2
zoom2size = {
    i: {"x": dzg.level_dimensions[i][0], "y": dzg.level_dimensions[i][1]}
    for i in range(min_zoom, max_zoom + 1)}

WSI_FILES_DIRECTORY = r'/Volumes/My Passport/B127/2022.7.22-BCC-JD-100-3'

@app.get("/wsi-list", response_model=List[str])
def wsi_list():
    files = os.listdir(WSI_FILES_DIRECTORY)
    wsi_files = [f for f in files if f.endswith('.ndpi')]
    return wsi_files

@app.get("/props/", response_model=dict)
def default_props():
    # 你可以在这里定义一个默认的WSI文件路径
    default_wsi_file = os.path.join(WSI_FILES_DIRECTORY, wsi_list()[0])
    return get_props_for_wsi(default_wsi_file)

def get_props_for_wsi(wsi_file: str):
    # 你原有的逻辑
    print(f'get props {wsi_file}')
    slide = openslide.OpenSlide(wsi_file)
    global dzg
    dzg = DeepZoomGenerator(slide, tile_size=args.tile_size, overlap=0, limit_bounds=False)
    max_zoom = dzg.level_count - 1
    min_zoom = int(max_zoom - math.log2(max(dzg.level_dimensions[-1])/args.tile_size))
    default_zoom = min_zoom + 2
    zoom2size = {
        i: {"x": dzg.level_dimensions[i][0], "y": dzg.level_dimensions[i][1]}
        for i in range(min_zoom, max_zoom + 1)
    }
    return {
        "tile_size": args.tile_size,
        "min_zoom": min_zoom,
        "max_zoom": max_zoom,
        "default_zoom": default_zoom,
        "bounds": dzg.level_dimensions[max_zoom],
        "zoom2size": zoom2size,
    }

@app.get("/props/{wsi_path:path}", response_model=dict)
def props(wsi_path: str):
    if wsi_path != '':
        print('wsi_path legeal')
        wsi_file = os.path.join(WSI_FILES_DIRECTORY, wsi_path)
    else:
        print('wsi_path not legeal')
        wsi_file = os.path.join(WSI_FILES_DIRECTORY, wsi_list()[0])
    return get_props_for_wsi(wsi_file)

@app.get("/tile/{level:int}/{x:int}/{y:int}", responses={
    200: {
        "content": {
            "image/png": {}
        }
    }
})
async def tile(x: int, y: int, level: int):
    if x < 0 or y < 0:
        return Response(content="", media_type="image/png")
    if dzg.level_tiles[level][0] <= x or dzg.level_tiles[level][1] <= y:
        return Response(content="", media_type="image/png")
    print()
    tile = dzg.get_tile(level, (x, y))
    if tile.size != (args.tile_size, args.tile_size):
        canvas = Image.new("RGBA", (args.tile_size, args.tile_size))
        canvas.paste(tile, (0, 0))
        tile = canvas
    buf = BytesIO()
    tile.save(buf, "png", quality=70)
    return Response(content=buf.getvalue(), media_type="image/png")

def main():
    uvicorn.run("wsiserver.app:app", host=args.host, port=args.port, log_level="info")

if __name__ == "__main__":
    main()
