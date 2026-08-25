import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def txt(node):
    return "".join(node.itertext()) if node is not None else ""


def main(path_str: str, out_dir_str: str):
    path = Path(path_str)
    out_dir = Path(out_dir_str)
    out_dir.mkdir(parents=True, exist_ok=True)
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        document_xml = ET.fromstring(z.read("word/document.xml"))

        paragraphs = []
        for p in document_xml.findall(".//w:p", NS):
            value = "".join(t.text or "" for t in p.findall(".//w:t", NS))
            if value.strip():
                style = p.find("./w:pPr/w:pStyle", NS)
                paragraphs.append({
                    "style": style.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val") if style is not None else None,
                    "text": value,
                })

        drawings = []
        for drawing in document_xml.findall(".//w:drawing", NS):
            texts = [t.text or "" for t in drawing.findall(".//a:t", NS)]
            extent = drawing.find(".//wp:extent", NS)
            drawings.append({
                "text": "".join(texts),
                "cx": extent.get("cx") if extent is not None else None,
                "cy": extent.get("cy") if extent is not None else None,
            })

        sections = []
        for sect in document_xml.findall(".//w:sectPr", NS):
            pg = sect.find("./w:pgSz", NS)
            mar = sect.find("./w:pgMar", NS)
            cols = sect.find("./w:cols", NS)
            sections.append({
                "page_size": dict(pg.attrib) if pg is not None else {},
                "margins": dict(mar.attrib) if mar is not None else {},
                "cols": dict(cols.attrib) if cols is not None else {},
            })

        media = []
        for name in names:
            if name.startswith("word/media/"):
                data = z.read(name)
                target = out_dir / Path(name).name
                target.write_bytes(data)
                media.append({"name": name, "size": len(data), "extracted": str(target)})

        styles_text = ""
        if "word/styles.xml" in names:
            styles_text = z.read("word/styles.xml").decode("utf-8", errors="replace")
        style_ids = sorted(set(re.findall(r'w:styleId="([^"]+)"', styles_text)))

        result = {
            "path": str(path),
            "sha256": sha,
            "size": path.stat().st_size,
            "package_parts": len(names),
            "paragraphs": paragraphs,
            "drawings": drawings,
            "sections": sections,
            "media": media,
            "style_ids": style_ids,
            "all_parts": names,
        }
        (out_dir / "inspection.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps({
            "path": str(path),
            "sha256": sha,
            "size": path.stat().st_size,
            "package_parts": len(names),
            "paragraph_count": len(paragraphs),
            "drawing_count": len(drawings),
            "section_count": len(sections),
            "media_count": len(media),
            "media": media,
        }, indent=2))
        print("\nPARAGRAPHS")
        for i, item in enumerate(paragraphs):
            print(f"{i:03d} [{item['style'] or '-'}] {item['text']}")
        print("\nDRAWINGS")
        for i, item in enumerate(drawings):
            print(f"{i:03d} {item}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
