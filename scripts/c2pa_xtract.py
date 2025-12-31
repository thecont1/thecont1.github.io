#!/usr/bin/env python3
"""
Extract C2PA Content Credentials from JPEG files.
Comprehensive extraction for image screener tool.
"""

import argparse
import json
import sys
import base64
import io
from pathlib import Path
from typing import Optional, Any
from c2pa import Reader


def extract_resource(reader: Reader, uri: str) -> Optional[bytes]:
    """Extract a resource from the manifest using resource_to_stream."""
    try:
        # Create a memory stream
        stream = io.BytesIO()
        # Some versions of resource_to_stream might take (uri, stream) 
        # others might take (uri) and return a stream.
        # Based on dir(reader), it's resource_to_stream.
        reader.resource_to_stream(uri, stream)
        return stream.getvalue()
    except Exception as e:
        sys.stderr.write(f"Error extracting resource {uri}: {e}\n")
        return None


def extract_full_manifest(filepath: Path) -> dict:
    """Extract complete C2PA manifest using all available methods."""
    try:
        reader = Reader(str(filepath))
    except Exception as e:
        error_str = str(e)
        if "ManifestNotFound" in error_str or "no JUMBF data found" in error_str:
            # This is a normal state for many images, return empty instead of erroring
            return {}
        # For other errors (IO, etc.), re-raise or handle as needed
        sys.stderr.write(f"C2PA Reader Error: {e}\n")
        return {}
    
    # Get the active manifest - this contains all the data
    manifest = reader.get_active_manifest() or {}
    
    # Add validation results from separate method
    validation_results = reader.get_validation_results()
    if validation_results:
        manifest["validation_results"] = validation_results
    
    # Add validation state
    manifest["validation_status"] = reader.get_validation_state()
    
    # Add thumbnails as base64 if they exist
    if manifest.get("thumbnail"):
        uri = manifest["thumbnail"].get("identifier")
        if uri:
            thumb_bytes = extract_resource(reader, uri)
            if thumb_bytes:
                manifest["thumbnail"]["data"] = base64.b64encode(thumb_bytes).decode('utf-8')

    # Add ingredient thumbnails
    for ingredient in manifest.get("ingredients", []):
        if ingredient.get("thumbnail"):
            uri = ingredient["thumbnail"].get("identifier")
            if uri:
                thumb_bytes = extract_resource(reader, uri)
                if thumb_bytes:
                    ingredient["thumbnail"]["data"] = base64.b64encode(thumb_bytes).decode('utf-8')
    
    return manifest


def get_claim_info(manifest: dict) -> dict:
    """Extract claim information."""
    return {
        "title": manifest.get("title", "Unknown"),
        "format": manifest.get("format", "Unknown"),
        "generator": manifest.get("claim_generator", "Unknown"),
        "instance_id": manifest.get("instance_id", "Unknown"),
        "generator_info": manifest.get("claim_generator_info", []),
        "label": manifest.get("label", "Unknown"),
    }


def get_authors(manifest: dict) -> list[dict]:
    """Get all author information."""
    for assertion in manifest.get("assertions", []):
        if assertion.get("label") == "stds.schema-org.CreativeWork":
            data = assertion.get("data", {})
            if isinstance(data, dict):
                return data.get("author", [])
    return []


def get_actions(manifest: dict) -> list[dict]:
    """Get all editing actions."""
    for assertion in manifest.get("assertions", []):
        if assertion.get("label") == "c2pa.actions.v2":
            data = assertion.get("data", {})
            if isinstance(data, dict):
                return data.get("actions", [])
    return []


def get_ingredient(manifest: dict) -> Optional[dict]:
    """Get ingredient (source file) info."""
    ingredients = manifest.get("ingredients", [])
    if ingredients:
        return ingredients[0]
    return None


def get_signature(manifest: dict) -> dict:
    """Get signature info."""
    return manifest.get("signature_info", {})


def format_action(action: dict) -> str:
    """Format a single action for display."""
    action_type = action.get("action", "unknown")
    params = action.get("parameters", {})
    
    if action_type == "c2pa.color_adjustments":
        acr_key = params.get("com.adobe.acr", "")
        acr_value = params.get("com.adobe.acr.value", "")
        return f"{acr_key}: {acr_value}"
    
    elif action_type == "c2pa.filtered":
        preset = params.get("com.adobe.acr.value", "")
        return f"Applied preset: {preset}"
    
    elif action_type == "c2pa.edited":
        tool = params.get("com.adobe.acr", "")
        desc = params.get("com.adobe.acr.value", "")
        return f"{tool}: {desc}"
    
    elif action_type == "c2pa.opened":
        return "Opened ingredient file"
    
    elif action_type == "c2pa.drawing":
        tool = params.get("com.adobe.acr", "")
        return f"Drawing: {tool}"
    
    else:
        return action_type.replace("c2pa.", "").replace("_", " ").title()


def print_screener(manifest: dict):
    """Print comprehensive manifest for image screener."""
    claim_info = get_claim_info(manifest)
    authors = get_authors(manifest)
    actions = get_actions(manifest)
    ingredient = get_ingredient(manifest)
    signature = get_signature(manifest)
    
    print("=" * 70)
    print("🔍 C2PA CONTENT CREDENTIALS - IMAGE X-RAY")
    print("=" * 70)
    
    # File Info Section
    print("\n📷 FILE INFORMATION")
    print("-" * 50)
    print(f"   Title:        {claim_info['title']}")
    print(f"   Format:       {claim_info['format']}")
    print(f"   Generator:    {claim_info['generator']}")
    print(f"   Instance ID:  {claim_info['instance_id']}")
    print(f"   Manifest ID:  {claim_info['label']}")
    
    if claim_info['generator_info']:
        print(f"\n   Generator Details:")
        for info in claim_info['generator_info']:
            name = info.get("name", "")
            version = info.get("version", "")
            c2pa_rs = info.get("org.cai.c2pa_rs", "")
            print(f"      • {name} v{version} (C2PA-RS: {c2pa_rs})")
    
    # Authors Section
    print("\n👤 CREATORS / AUTHORS")
    print("-" * 50)
    if authors:
        for i, author in enumerate(authors, 1):
            name = author.get("name", "Unknown")
            author_id = author.get("@id", "")
            author_type = author.get("@type", "Person")
            print(f"   {i}. {name}")
            if author_id:
                # Truncate long URLs
                if len(author_id) > 50:
                    print(f"      ID: {author_id[:50]}...")
                else:
                    print(f"      ID: {author_id}")
            print(f"      Type: {author_type}")
    else:
        print("   (No author information)")
    
    # Source File Section
    if ingredient:
        print("\n📁 SOURCE FILE (INGREDIENT)")
        print("-" * 50)
        print(f"   Name:         {ingredient.get('title', 'Unknown')}")
        print(f"   Format:       {ingredient.get('format', 'Unknown')}")
        print(f"   Relationship: {ingredient.get('relationship', 'Unknown')}")
        print(f"   Document ID:  {ingredient.get('document_id', 'Unknown')}")
        print(f"   Instance ID:  {ingredient.get('instance_id', 'Unknown')}")
        if ingredient.get("thumbnail"):
            thumb = ingredient.get("thumbnail", {})
            print(f"   Thumbnail:    {thumb.get('identifier', 'Unknown')[:50]}...")
    
    # Editing History Section
    print("\n🔧 EDITING HISTORY")
    print("-" * 50)
    print(f"   Total actions: {len(actions)}")
    if actions:
        print()
        for i, action in enumerate(actions, 1):
            print(f"   {i:2}. {format_action(action)}")
    else:
        print("   (No action data)")
    
    # Assertions Section
    print("\n📋 ASSERTIONS")
    print("-" * 50)
    for a in manifest.get("assertions", []):
        label = a.get("label", "Unknown")
        data = a.get("data", {})
        kind = a.get("kind", "")
        
        if isinstance(data, dict):
            print(f"   • {label} ({kind or 'Json'})")
        elif isinstance(data, bytes):
            print(f"   • {label} (binary, {len(data)} bytes)")
        else:
            print(f"   • {label} ({type(data).__name__})")
    
    # Thumbnails Section
    if manifest.get("thumbnail"):
        print("\n🖼️ THUMBNAILS")
        print("-" * 50)
        thumb = manifest.get("thumbnail", {})
        print(f"   Format:  {thumb.get('format', 'Unknown')}")
        print(f"   ID:      {thumb.get('identifier', 'Unknown')[:60]}...")
    
    # Signature Section
    print("\n🔐 SIGNATURE")
    print("-" * 50)
    if signature:
        print(f"   Algorithm:         {signature.get('alg', 'Unknown')}")
        print(f"   Issuer:            {signature.get('issuer', 'Unknown')}")
        print(f"   Common Name:       {signature.get('common_name', 'Unknown')}")
        print(f"   Cert Serial:       {signature.get('cert_serial_number', 'Unknown')[:20]}...")
        print(f"   Timestamp:         {signature.get('time', 'Unknown')}")
    else:
        print("   (Signature data not available)")
    
    # Validation Section
    print("\n✅ VALIDATION STATUS")
    print("-" * 50)
    
    validation_status = manifest.get("validation_status", "Unknown")
    validation_results = manifest.get("validation_results", {})
    active = validation_results.get("activeManifest", {})
    
    success = active.get("success", [])
    failures = active.get("failure", [])
    informational = active.get("informational", [])
    
    print(f"   Overall:      {validation_status}")
    print(f"   Passed:       {len(success)} checks")
    
    if success:
        print("\n   ✓ Validation checks:")
        for s in success[:5]:
            code = s.get("code", "").replace(".", " ").replace("_", " ").title()
            print(f"      • {code}")
        if len(success) > 5:
            print(f"      ... and {len(success) - 5} more")
    
    if informational:
        print(f"\n   ℹ Informational: {len(informational)}")
        for info in informational[:2]:
            code = info.get("code", "").replace(".", " ").replace("_", " ").title()
            explanation = info.get("explanation", "")[:60]
            print(f"      • {code}: {explanation}...")
    
    if failures:
        print(f"\n   ✗ Failed: {len(failures)}")
        for f in failures:
            code = f.get("code", "").replace(".", " ").replace("_", " ").title()
            print(f"      • {code}")
    
    # Ingredient provenance
    ingredient_deltas = validation_results.get("ingredientDeltas", [])
    if ingredient_deltas:
        print("\n📦 INGREDIENT PROVENANCE")
        print("-" * 50)
        for delta in ingredient_deltas:
            v_delta = delta.get("validationDeltas", {})
            v_info = v_delta.get("informational", [])
            
            for info in v_info:
                explanation = info.get("explanation", "")
                print(f"   ℹ {explanation}")
    
    print("\n" + "=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Extract and display C2PA Content Credentials (Image X-Ray)"
    )
    parser.add_argument("file", type=Path, help="JPEG file to analyze")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    
    args = parser.parse_args()
    
    if not args.file.exists():
        print(f"Error: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)
    
    if not args.json:
        print(f"Analyzing: {args.file}\n")
    
    manifest = extract_full_manifest(args.file)
    
    if args.json:
        # If manifest is empty {}, this will print "{}" which the API now handles
        print(json.dumps(manifest, indent=2, default=str))
    else:
        if not manifest:
            print("No C2PA manifest found or could not parse the file.")
        else:
            print_screener(manifest)


if __name__ == "__main__":
    main()
