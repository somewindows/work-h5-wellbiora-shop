#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
思源宋体（Noto Serif SC）中文字体子集构建
用途：扫描 frontend/src 与 frontend/mock 中实际用到的中文字符，
     从可变字库实例化 600/700 两个字重并裁剪为最小 woff2，输出到 public/fonts/。
文案改动后重跑：
  python -m venv .venv-fonts && .venv-fonts/Scripts/pip install fonttools brotli
  .venv-fonts/Scripts/python scripts/build_font_subset.py
注意：子集外的字会回退系统字体（优雅降级），故只适合标题类局部使用。
"""
import re
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".font-cache"
OUT = ROOT / "public" / "fonts"
# Noto Serif SC 可变字库（google/fonts 官方仓库）
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
WEIGHTS = (600, 700)

# CJK 统一表意文字 + 中文标点（全角、常用符号）
RE = re.compile(r"[一-鿿　-〿＀-￯·—…×]")
# 常用保底字符（标题常用但当前文案未出现的）
FALLBACK = "的一是不了在人我中有他为这你着个之地来要就去说得和很与会可而于年由到对但所如最还只以想时些呢吧吗啊啦嘛新品上市热卖推荐"


def collect_chars() -> str:
    chars = set(FALLBACK)
    for folder in ("src", "mock"):
        for f in (ROOT / folder).rglob("*"):
            if f.suffix in (".vue", ".ts", ".css"):
                chars.update(RE.findall(f.read_text(encoding="utf-8")))
    return "".join(sorted(chars))


def download_font() -> Path:
    CACHE.mkdir(exist_ok=True)
    path = CACHE / "NotoSerifSC-VF.ttf"
    if not path.exists():
        print("下载可变字库（约 20MB，仅首次）…")
        req = urllib.request.Request(FONT_URL, headers={"User-Agent": "Mozilla/5.0"})
        path.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    return path


def build(weight: int, chars: str, src: Path) -> None:
    font = TTFont(src)
    instantiateVariableFont(font, {"wght": weight}, inplace=True)
    out = OUT / f"noto-serif-sc-{weight}.woff2"
    opts = subset.Options(flavor="woff2", layout_features="*")
    opts.name_IDs = ["*"]
    sub = subset.Subsetter(opts)
    # 子集里保留 ASCII/数字，标题混排英文时字重一致
    sub.populate(text=chars, unicodes=list(range(0x20, 0x7F)))
    sub.subset(font)
    font.flavor = "woff2"
    font.save(out)
    print(f"已生成 {out.name}（{out.stat().st_size / 1024:.1f} KB）")


def main() -> None:
    chars = collect_chars()
    print(f"收集字符 {len(chars)} 个")
    src = download_font()
    OUT.mkdir(exist_ok=True)
    for w in WEIGHTS:
        build(w, chars, src)


if __name__ == "__main__":
    sys.exit(main())
