import os
import xml.etree.ElementTree as ET

def create_drawio_xml():
    """Generates an editable Draw.io XML file containing all flowchart pages."""
    
    pages = [
        ("Figure 2. Landing Page Flowchart", "fig2"),
        ("Figure 3. Student Voter Dashboard Flowchart", "fig3"),
        ("Figure 4. Admin Dashboard Flowchart", "fig4"),
        ("Figure 5. Voters and Candidates Management Flowchart", "fig5"),
        ("Figure 6. Archive and Recovery Management Flowchart", "fig6"),
        ("Figure 7. Election Control and Schedule Flowchart", "fig7"),
        ("Figure 8. Election Results and Analytics Flowchart", "fig8"),
    ]
    
    mxfile = ET.Element('mxfile', host="app.diagrams.net", type="device")
    
    for title, pid in pages:
        diagram = ET.SubElement(mxfile, 'diagram', name=title, id=pid)
        model = ET.SubElement(diagram, 'mxGraphModel', dx="1200", dy="800", grid="1", gridSize="10", guides="1", tooltips="1", connect="1", arrows="1", fold="1", page="1", pageScale="1", pageWidth="1169", pageHeight="827", math="0", shadow="0")
        root = ET.SubElement(model, 'root')
        ET.SubElement(root, 'mxCell', id="0")
        ET.SubElement(root, 'mxCell', id="1", parent="0")
        
        # Add Header label
        header = ET.SubElement(root, 'mxCell', id=f"{pid}_hdr", value=f"<b>{title}</b>", style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=16;", vertex="1", parent="1")
        ET.SubElement(header, 'mxGeometry', x="200", y="20", width="600", height="40", **{"as": "geometry"})

    drawio_path = os.path.join(os.path.dirname(__file__), "Batuan_Voting_Flowcharts.drawio")
    tree = ET.ElementTree(mxfile)
    ET.indent(tree, space="  ", level=0)
    tree.write(drawio_path, encoding="utf-8", xml_declaration=True)
    print(f"Generated Draw.io XML: {drawio_path}")
    return drawio_path

if __name__ == "__main__":
    create_drawio_xml()
