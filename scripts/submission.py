"""Render the submission from the verified deployment manifest."""
from pathlib import Path
from io import BytesIO
from PIL import Image as RasterImage
from xml.sax.saxutils import escape
import json
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "public/evidence/deployment.json").read_text())
manifest.setdefault("repository", "https://github.com/alaminvyn/seismiclock-primus")
ready = all(manifest.get(key) for key in ("escrow","verifier","deploymentTx","fundingTx","settlementTx"))
output = root / "output/pdf"
output.mkdir(parents=True, exist_ok=True)
ink, amber, gray = map(colors.HexColor, ("#1c2528","#936328","#49585c"))
styles = {
    "title": ParagraphStyle("Title",fontName="Helvetica-Bold",fontSize=34,leading=37,textColor=ink,spaceAfter=9),
    "heading": ParagraphStyle("Heading",fontName="Helvetica-Bold",fontSize=16,leading=20,textColor=ink,spaceBefore=14,spaceAfter=6),
    "body": ParagraphStyle("Body",fontName="Helvetica",fontSize=10.5,leading=15.5,textColor=gray,spaceAfter=7),
    "label": ParagraphStyle("Label",fontName="Helvetica-Bold",fontSize=10,leading=13,textColor=amber,spaceAfter=8),
    "cell": ParagraphStyle("Cell",fontName="Helvetica",fontSize=9.4,leading=13,textColor=ink),
}

def para(text, style="body"):
    return Paragraph(text, styles[style])

def footer(canvas, doc):
    width, _ = doc.pagesize
    canvas.setStrokeColor(colors.HexColor("#d2d8d8"))
    canvas.line(46,42,width-46,42)
    canvas.setFont("Helvetica",9)
    canvas.setFillColor(gray)
    canvas.drawString(46,27,"SEISMICLOCK   /   PRIMUS BUILDER PROJECT")
    canvas.drawRightString(width-46,27,str(doc.page))

def external(url, label):
    safe = escape(url, {'"': '&quot;'})
    return f'<link href="{safe}" color="#80561f">{escape(label)}</link>'

def grid(rows):
    table = Table([[para(left,"cell"),para(right,"cell")] for left,right in rows],colWidths=[1.45*inch,5.25*inch])
    table.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),9),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("ROWBACKGROUNDS",(0,0),(-1,-1),[colors.HexColor("#f0f3f1"),colors.white]),
        ("LINEBELOW",(0,0),(-1,-1),0.35,colors.HexColor("#dbe0dc")),
    ]))
    return table

story = [
    para("PRIMUS BUILDER PROJECT  /  BASE SEPOLIA 84532","label"),
    para("SeismicLock","title"),
    para("Proof-powered emergency settlement"),
    Image(str(root/"public/brand/social.png"),width=6.7*inch,height=3.5175*inch),
    Spacer(1,12),
    para("Project overview","heading"),
    para("SeismicLock demonstrates how a reviewed earthquake record can trigger the conditional release of a fixed testnet escrow. The historical exercise follows USGS event us6000jllz, the magnitude 7.8 Pazarcik earthquake, through a genuine Primus attestation and a Solidity policy."),
    para("Practical application","heading"),
    para("An emergency fund can precommit a beneficiary, geographic rectangle, magnitude threshold and event window. A verified evidence trail makes the payout decision reproducible. The exercise uses historical data and Base Sepolia test funds."),
    para("Implementation status","heading"),
    para("The Base Sepolia deployment and settlement are recorded in the evidence section." if ready else "Local settlement and security tests completed with real Primus proofs. Base Sepolia receipts and the public production site are pending. This is a draft submission."),
    PageBreak(),
    para("ARCHITECTURE AND EVIDENCE","label"),
    para("From source to settlement","heading"),
    grid([
        ("USGS catalog","One bounded GeoJSON query. Eight revealed fields identify event, status, magnitude, coordinates, occurrence and revision."),
        ("Primus Core SDK","Proxy TLS signs the source request, disclosure, beneficiary, millisecond timestamp and a scope bound to the chain, escrow and policy version."),
        ("Project verifier","The published PrimusZKTLS Solidity code is configured with the independently confirmed official production signer. The signing authority remains with Primus."),
        ("Solidity escrow","An exact source, disclosure grammar, geographic boundary, threshold and time policy precede release. Terminal state blocks replay. The funder can reclaim an expired deposit."),
    ]),
    para("Verifier trust and limitations","heading"),
    para("The documented Primus-operated Base Sepolia verifier rejected the original signature because its signer set did not include the Core SDK production signer. This project uses a standalone verifier with frozen authority. Signer rotation and revocation require a replacement verifier and a new escrow. A signed USGS response proves a snapshot and cannot establish the absence of an upstream revision."),
    para("Verification and testing","heading"),
    para("30 local EVM tests passed, including authentic settlement, mutated signatures, policy failures, replay, refund, reentrancy and transfer rollback. Verification calls are read-only. Local outcomes and testnet receipts have different provenance."),
    para("Reproduction and public evidence","heading"),
    para("Run pnpm compile, pnpm test and pnpm build from the repository. To issue a fresh proof, use the Core SDK with an authorized Primus application in the local proof runner and supply the exact escrow and beneficiary."),
]
if ready:
    story += [
        PageBreak(), para("BASE SEPOLIA TRANSACTION RECORD","label"),
        para("Verified contracts and receipts","heading"),
        para("Both project contracts have exact source matches on Sourcify. The explorer links identify the successful deployment, deposit and payout. " + ("All three receipts reached Base Sepolia finality." if all(item.get("finalized") for item in manifest.get("receipts", {}).values()) else "The receipt manifest reports network finality separately.")),
    ]
    explorer = "https://sepolia.basescan.org"
    keys = [("Escrow","address","escrow"),("Project verifier","address","verifier"),
            ("Deployment","tx","deploymentTx"),("Funding","tx","fundingTx"),("Settlement","tx","settlementTx")]
    story.append(grid([(label,external(f"{explorer}/{kind}/{manifest[key]}",manifest[key])) for label,kind,key in keys]))
    story += [
        para("Recorded checks","heading"),
        para(f"At block {manifest.get('checksBeforeSettlement',{}).get('block','pending')}, the verifier accepted both genuine proofs, rejected modified earthquake data, and the escrow accepted the bound proof while rejecting the original gate proof for the incorrect beneficiary."),
        para(f"At block {manifest.get('duplicateAfterSettlement',{}).get('block','pending')}, a repeat settlement reverted. The payout released the full 0.0001 test ETH principal."),
    ]
else:
    story.append(para("Public URLs and transaction receipts will be added after their verification."))
for key,label in (("repository","Public GitHub repository"),("website","Production Vercel site")):
    if manifest.get(key): story.append(para(external(manifest[key],label)))
screenshots = [root / "output/screenshots" / file for file in ("dashboard-desktop.png","dashboard-mobile.png")]
if any(path.exists() for path in screenshots):
    story += [PageBreak(),para("DASHBOARD","label"),para("Reviewer interface","heading")]
    for image in screenshots:
        if not image.exists(): continue
        if image.name.endswith("mobile.png"):
            with RasterImage.open(image) as screen:
                crop = screen.crop((0, 0, screen.width, min(screen.height, 844)))
                capture = BytesIO()
                crop.save(capture, format="PNG")
                capture.seek(0)
            picture = Image(capture)
        else:
            picture = Image(str(image))
        factor = min(6.7*inch/picture.imageWidth,3.65*inch/picture.imageHeight)
        picture.drawWidth,picture.drawHeight=picture.imageWidth*factor,picture.imageHeight*factor
        story += [picture,Spacer(1,8)]
name = "seismiclock-submission.pdf" if ready and manifest.get("website") else "seismiclock-submission-draft.pdf"
SimpleDocTemplate(str(output/name),pagesize=(576,756),leftMargin=46,rightMargin=46,topMargin=43,bottomMargin=55,title="SeismicLock | Primus Builder Submission",author="SeismicLock").build(story,onFirstPage=footer,onLaterPages=footer)
