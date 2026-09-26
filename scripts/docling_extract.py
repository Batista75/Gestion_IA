#!/usr/bin/env python3
"""Convert local files with Docling. Models stay under DOCLING_ARTIFACTS_PATH. CPU only."""

import json
import os
import shutil
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", category=DeprecationWarning)


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: docling_extract.py --prefetch | --ready | <output.json> <file>...", file=sys.stderr)
        return 2
    if sys.argv[1] == "--ready":
        try:
            import docling  # noqa: F401
        except ImportError:
            return 3
        return 0
    if sys.argv[1] == "--prefetch":
        return prefetch()
    if len(sys.argv) < 3:
        print("usage: docling_extract.py <output.json> <file>...", file=sys.stderr)
        return 2
    output = Path(sys.argv[1])
    paths = [Path(item) for item in sys.argv[2:]]
    try:
        converter = build_converter()
        chunker = build_chunker()
    except ImportError:
        output.write_text(json.dumps({"ok": False, "reason": "missing"}), encoding="utf-8")
        return 3
    files = []
    for path in paths:
        try:
            document = converter.convert(str(path)).document
            markdown = document.export_to_markdown() or ""
            files.append({"markdown": markdown, "chunks": chunk_texts(chunker, document)})
        except Exception as exc:  # noqa: BLE001 - one file must not abort the batch
            files.append({"markdown": "", "chunks": [], "error": str(exc)})
    output.write_text(json.dumps({"ok": True, "files": files}, ensure_ascii=False), encoding="utf-8")
    return 0


def prefetch() -> int:
    artifacts = Path(os.environ.get("DOCLING_ARTIFACTS_PATH") or "data/docling")
    artifacts.mkdir(parents=True, exist_ok=True)
    try:
        import docling  # noqa: F401
    except ImportError:
        print("Docling n’est pas installé dans cet environnement Python.", file=sys.stderr)
        return 3
    try:
        from docling.utils.model_downloader import download_models

        try:
            download_models(
                output_dir=artifacts,
                with_easyocr=False,
                with_rapidocr=False,
                with_code_formula=False,
                with_picture_classifier=False,
            )
        except TypeError:
            download_models(output_dir=artifacts)
    except Exception as exc:  # noqa: BLE001 - installation must not pretend the models are local
        print(f"Téléchargement des modèles : {exc}", file=sys.stderr)
        return 1
    build_chunker()
    (artifacts / ".ready").write_text("ok\n", encoding="utf-8")
    print(f"Modèles Docling prêts dans {artifacts}")
    return 0


def build_converter():
    from docling.datamodel.base_models import InputFormat
    from docling.document_converter import DocumentConverter, ImageFormatOption, PdfFormatOption

    options = pipeline_options()
    format_options = {InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
    image = getattr(InputFormat, "IMAGE", None)
    if image is not None:
        format_options[image] = ImageFormatOption(pipeline_options=options)
    return DocumentConverter(format_options=format_options)


def pipeline_options():
    from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
    from docling.datamodel.pipeline_options import PdfPipelineOptions

    options = PdfPipelineOptions()
    options.do_table_structure = True
    options.accelerator_options = AcceleratorOptions(num_threads=4, device=AcceleratorDevice.CPU)
    artifacts = os.environ.get("DOCLING_ARTIFACTS_PATH")
    if artifacts:
        options.artifacts_path = artifacts
    if shutil.which("tesseract"):
        try:
            from docling.datamodel.pipeline_options import TesseractCliOcrOptions

            options.do_ocr = True
            options.ocr_options = TesseractCliOcrOptions(lang=["fra", "eng"])
        except Exception:  # noqa: BLE001
            options.do_ocr = False
    else:
        options.do_ocr = False
    return options


def build_chunker():
    from docling.chunking import HybridChunker

    return HybridChunker(max_tokens=480, merge_peers=True)


def chunk_texts(chunker, document) -> list[str]:
    texts: list[str] = []
    contextualize = getattr(chunker, "contextualize", None)
    for chunk in chunker.chunk(document):
        text = contextualize(chunk) if callable(contextualize) else getattr(chunk, "text", "")
        cleaned = str(text or "").strip()
        if cleaned:
            texts.append(cleaned)
        if len(texts) >= 48:
            break
    return texts


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportError:
        if len(sys.argv) > 2 and sys.argv[1] not in {"--ready", "--prefetch"}:
            Path(sys.argv[1]).write_text(
                json.dumps({"ok": False, "reason": "missing"}),
                encoding="utf-8",
            )
        raise SystemExit(3)
