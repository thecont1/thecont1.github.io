#!/usr/bin/env python3
"""
Build-time EXIF extraction script - Version 2
Creates organized metadata files that mirror the directory structure
"""

import os
import json
import sys
import argparse
from pathlib import Path
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import warnings

warnings.filterwarnings('ignore', category=UserWarning)

def clean_text_encoding(text):
    """Clean and fix text encoding issues - improved version."""
    if not isinstance(text, str):
        return str(text)
    
    # Handle bytes objects
    if isinstance(text, bytes):
        try:
            text = text.decode('utf-8', errors='replace')
        except:
            text = str(text)
    
    import re
    
    # Fix mojibake: UTF-8 bytes interpreted as Latin-1
    # â\x80\x99 is the mojibake for ' (RIGHT SINGLE QUOTATION MARK, U+2019)
    # â\x80\x9c is the mojibake for " (LEFT DOUBLE QUOTATION MARK, U+201C)
    # â\x80\x9d is the mojibake for " (RIGHT DOUBLE QUOTATION MARK, U+201D)
    # â\x80\x94 is the mojibake for — (EM DASH, U+2014)
    # â\x80\x93 is the mojibake for – (EN DASH, U+2013)
    mojibake_fixes = {
        'â\x80\x99': "'",  # Right single quotation mark -> apostrophe
        'â\x80\x98': "'",  # Left single quotation mark -> apostrophe
        'â\x80\x9c': '"',  # Left double quotation mark
        'â\x80\x9d': '"',  # Right double quotation mark
        'â\x80\x94': '—',  # Em dash
        'â\x80\x93': '–',  # En dash
        'â\x80¦': '…',    # Ellipsis
    }
    
    for bad, good in mojibake_fixes.items():
        text = text.replace(bad, good)
    
    # Common problematic character mappings
    replacements = {
        'Ã¼': 'ü',  'Ã¡': 'á',  'Ã©': 'é',  'Ã­': 'í',  'Ã³': 'ó',  'Ãº': 'ú',
        'Ã±': 'ñ',  'Ã§': 'ç',  'Â©': '©',  'Â®': '®',  'â¢': '•',
    }
    
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    
    # First handle apostrophes in contractions: Itâs -> It's  
    text = re.sub(r"(\w)â(s\b|t\b|re\b|ll\b|ve\b|d\b)", r"\1'\2", text)
    
    # Then handle remaining smart quotes pattern: âTextâ -> "Text"
    text = re.sub(r'â([^â]+)â', r'"\1"', text)
    
    # Handle any remaining smart quotes and apostrophes
    text = text.replace('â', '"')  # Left smart quote
    text = text.replace('â', '"')  # Right smart quote  
    text = text.replace('â', "'")  # Smart apostrophe
    text = text.replace('â', '—')  # Em dash
    text = text.replace('â', '–')  # En dash
    
    # CRITICAL FIX: Handle double quotes used as apostrophes in contractions
    # Pattern: word"s, word"t, word"ll, word"re, word"ve, word"d
    # This converts Michel"s -> Michel's using a proper apostrophe
    text = re.sub(r'(\w)"(s\b|t\b|re\b|ll\b|ve\b|d\b)', r"\1'\2", text)
    
    return text.strip()

def extract_image_metadata(image_path):
    """Extract comprehensive metadata from a single image."""
    try:
        with Image.open(image_path) as image:
            metadata = {
                "filename": os.path.basename(image_path),
                "format": image.format,
                "size": list(image.size),
                "width": image.size[0],
                "height": image.size[1],
            }
            
            # Extract EXIF data
            exif_data = {}
            if hasattr(image, '_getexif') and image._getexif():
                exif = image._getexif()
                for tag_id, value in exif.items():
                    tag = TAGS.get(tag_id, tag_id)
                    
                    # Handle different value types
                    if hasattr(value, 'numerator') and hasattr(value, 'denominator'):
                        exif_data[tag] = float(value) if value.denominator != 0 else str(value)
                    elif isinstance(value, (bytes, tuple)):
                        exif_data[tag] = clean_text_encoding(str(value))
                    elif isinstance(value, str):
                        exif_data[tag] = clean_text_encoding(value)
                    else:
                        try:
                            json.dumps(value)  # Test JSON serialization
                            exif_data[tag] = value
                        except (TypeError, ValueError):
                            exif_data[tag] = clean_text_encoding(str(value))
            
            # Try newer getexif() method
            try:
                newer_exif = image.getexif()
                if newer_exif:
                    for tag_id, value in newer_exif.items():
                        tag = TAGS.get(tag_id, f"Tag_{tag_id}")
                        if tag not in exif_data:  # Don't overwrite existing
                            if isinstance(value, str):
                                exif_data[tag] = clean_text_encoding(value)
                            else:
                                try:
                                    json.dumps(value)
                                    exif_data[tag] = value
                                except (TypeError, ValueError):
                                    exif_data[tag] = clean_text_encoding(str(value))
            except:
                pass
            
            metadata["exif"] = exif_data
            
            # Extract structured photography data
            photography = {}
            
            # Camera info
            if "Make" in exif_data:
                make = clean_text_encoding(str(exif_data["Make"]))
                photography["camera_make"] = make
                
            if "Model" in exif_data:
                model = clean_text_encoding(str(exif_data["Model"]))
                # Remove redundant manufacturer name
                if "camera_make" in photography:
                    make_words = photography["camera_make"].upper().split()
                    model_upper = model.upper()
                    for word in make_words:
                        if model_upper.startswith(word + " "):
                            model = model[len(word):].strip()
                            break
                photography["camera_model"] = model
            
            # Lens
            if "LensModel" in exif_data:
                photography["lens_model"] = clean_text_encoding(str(exif_data["LensModel"]))
            
            # Settings
            if "FNumber" in exif_data:
                f_val = exif_data["FNumber"]
                photography["aperture"] = f"f/{f_val}"
            
            if "ExposureTime" in exif_data:
                exp_time = exif_data["ExposureTime"]
                if isinstance(exp_time, (int, float)):
                    if exp_time >= 1:
                        photography["shutter_speed"] = f"{exp_time}s"
                    else:
                        photography["shutter_speed"] = f"1/{int(1/exp_time)}s"
                else:
                    photography["shutter_speed"] = str(exp_time)
            
            if "ISOSpeedRatings" in exif_data:
                photography["iso"] = exif_data["ISOSpeedRatings"]
            
            if "FocalLength" in exif_data:
                focal = exif_data["FocalLength"]
                photography["focal_length"] = f"{focal:.0f}mm" if isinstance(focal, (int, float)) else f"{focal}mm"
            
            # Dates
            if "DateTimeOriginal" in exif_data:
                photography["date_original"] = exif_data["DateTimeOriginal"]
            elif "DateTime" in exif_data:
                photography["date_taken"] = exif_data["DateTime"]
            
            # Creator info
            if "Artist" in exif_data:
                photography["artist"] = clean_text_encoding(str(exif_data["Artist"]))
            
            if "Copyright" in exif_data:
                photography["copyright"] = clean_text_encoding(str(exif_data["Copyright"]))
            
            # Title and description
            if "ImageDescription" in exif_data:
                desc = clean_text_encoding(str(exif_data["ImageDescription"]))
                photography["description"] = desc
                
            # Try to extract title from description or use filename
            title = ""
            if "ImageDescription" in exif_data:
                desc = photography.get("description", "")
                # Look for title patterns (first sentence, or text before period)
                if ". " in desc:
                    potential_title = desc.split(". ")[0]
                    if len(potential_title) < 100:  # Reasonable title length
                        title = potential_title
            
            if not title and "DocumentName" in exif_data:
                title = clean_text_encoding(str(exif_data["DocumentName"]))
            
            if title:
                photography["title"] = title
            
            metadata["photography"] = photography
            return metadata
            
    except Exception as e:
        return {"error": f"Failed to extract metadata: {str(e)}", "filename": os.path.basename(image_path)}

def main():
    """Extract EXIF data and co-locate with images in their directories."""

    parser = argparse.ArgumentParser(
        description="Extract EXIF data and write co-located metadata.json files"
    )
    parser.add_argument(
        "--dir",
        dest="dir",
        default="",
        help="Limit processing to a subdirectory under public/library/originals (e.g. 'AFRICA' or 'WEDDINGS').",
    )
    parser.add_argument(
        "--file",
        dest="file",
        default="",
        help="Limit processing to a single image file path under public/library/originals.",
    )
    args = parser.parse_args()

    # Paths
    project_root = Path(__file__).parent.parent
    originals_dir = project_root / "public" / "library" / "originals"

    # Determine scan root
    scan_root = originals_dir
    if args.dir:
        scan_root = originals_dir / args.dir
    if args.file:
        scan_root = (originals_dir / args.file).parent

    if not scan_root.exists():
        print(f"❌ Scan path not found: {scan_root}")
        sys.exit(1)

    # Clean existing metadata files
    clean_root = originals_dir if (not args.dir and not args.file) else scan_root
    for root, dirs, files in os.walk(clean_root):
        metadata_file = Path(root) / "metadata.json"
        if metadata_file.exists():
            metadata_file.unlink()
            print(f"🗑️  Removed old metadata: {metadata_file.relative_to(project_root)}")

    print(f"🔍 Scanning for images in: {scan_root}")
    
    # Find all image files organized by directory
    image_extensions = {'.jpg', '.jpeg', '.png', '.tiff', '.tif'}
    directories_processed = {}
    total_processed = 0
    
    # Walk through all subdirectories
    for root, dirs, files in os.walk(scan_root):
        root_path = Path(root)
        
        # Skip if no image files in this directory
        image_files = []
        for file in files:
            if any(file.lower().endswith(ext) for ext in image_extensions):
                image_files.append(root_path / file)
        
        if not image_files:
            continue
            
        # Get relative path from originals directory
        rel_dir = root_path.relative_to(originals_dir)
        
        print(f"📁 Processing directory: {rel_dir} ({len(image_files)} images)")
        
        # Process images in this directory
        directory_metadata = {}
        processed_in_dir = 0
        
        for image_path in image_files:
            try:
                print(f"  📸 {image_path.name}")
                metadata = extract_image_metadata(image_path)
                
                if "error" not in metadata:
                    directory_metadata[image_path.name] = metadata
                    processed_in_dir += 1
                else:
                    print(f"    ❌ Error: {metadata['error']}")
                    
            except Exception as e:
                print(f"    ❌ Failed to process {image_path.name}: {e}")
        
        # Save metadata directly in the image directory
        if directory_metadata:
            output_file = root_path / "metadata.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(directory_metadata, f, indent=2, ensure_ascii=False)
            
            directories_processed[str(rel_dir)] = {
                "images": processed_in_dir,
                "metadata_file": str(output_file.relative_to(project_root))
            }
            total_processed += processed_in_dir
    
    print(f"\n✅ Processed {total_processed} images across {len(directories_processed)} directories")
    print(f"💾 Created {len(directories_processed)} metadata files (co-located with images)")
    print(f"📁 Metadata files are co-located in public/library/originals/")
    
    # Test specific image mentioned by user (only in full scan)
    if not args.dir and not args.file:
        test_dir = originals_dir / "TheAfricanPortraits"
        test_file = test_dir / "metadata.json"
        if test_file.exists():
            with open(test_file, 'r', encoding='utf-8') as f:
                test_data = json.load(f)
            
            test_image = "MS201705-AfricanPortraits0060.jpg"
            if test_image in test_data:
                print(f"\n🎯 Test image metadata:")
                photo = test_data[test_image].get("photography", {})
                print(f"  Title: {photo.get('title', 'N/A')}")
                print(f"  Camera: {photo.get('camera_make', '')} {photo.get('camera_model', '')}")
                print(f"  Description: {photo.get('description', 'N/A')[:100]}...")

if __name__ == "__main__":
    main()