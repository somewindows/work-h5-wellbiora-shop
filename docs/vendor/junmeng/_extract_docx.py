# -*- coding: utf-8 -*-
"""一次性脚本：把君梦 openApi2.0 文档 docx 转成 Markdown（保留标题层级与表格）。
仅用标准库，运行后可删除。"""
import re
import zipfile
import xml.etree.ElementTree as ET

SRC = "docs/vendor/junmeng/君梦openApi2.0文档.docx"
DST = "docs/vendor/junmeng/_full.md"

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = NS["w"]

HEADING_STYLES = {
    "000002": 1,
    "000004": 2,
    "000009": 2,
    "000006": 3,
    "000008": 4,
    "000017": 5,
}


def text_of(elem):
    return "".join(t.text or "" for t in elem.iter(f"{{{W}}}t"))


def para_style(p):
    pPr = p.find("w:pPr", NS)
    if pPr is None:
        return None
    st = pPr.find("w:pStyle", NS)
    if st is None:
        return None
    return st.get(f"{{{W}}}val")


def table_to_md(tbl):
    rows = []
    for tr in tbl.findall("w:tr", NS):
        cells = []
        for tc in tr.findall("w:tc", NS):
            txt = " ".join(
                text_of(p).strip() for p in tc.findall(".//w:p", NS)
            ).strip()
            txt = re.sub(r"\s+", " ", txt).replace("|", "\\|")
            cells.append(txt)
        rows.append(cells)
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    out = ["| " + " | ".join(rows[0]) + " |",
           "|" + "---|" * width]
    for r in rows[1:]:
        out.append("| " + " | ".join(r) + " |")
    return "\n".join(out)


def main():
    with zipfile.ZipFile(SRC) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find("w:body", NS)

    lines = []
    for child in body:
        tag = child.tag.split("}")[1]
        if tag == "p":
            txt = text_of(child).strip()
            if not txt:
                continue
            style = para_style(child) or ""
            # 本文档样式映射：000002=H1, 000004/000009=H2, 000006=H3, 000008=H4, 000017=H5
            level = HEADING_STYLES.get(style)
            if level:
                lines.append(f"{'#' * level} {txt}")
            elif style.lower().startswith("toc"):
                continue  # 跳过目录
            else:
                lines.append(txt)
        elif tag == "tbl":
            lines.append(table_to_md(child))
    md = "\n\n".join(lines)
    with open(DST, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"written {DST}, {len(md)} chars")


if __name__ == "__main__":
    main()
