import { CR_LOGO_SVG } from "../icons/cr-logo-svg";
import { openC2PAOverlay } from "../../utils/c2pa.js";

type ImageMetadata = {
  filename?: string;
  format?: string;
  size?: [number, number];
  width?: number;
  height?: number;
  exif?: Record<string, any>;
  photography?: {
    camera_make?: string;
    camera_model?: string;
    lens_model?: string;
    aperture?: string;
    shutter_speed?: string;
    iso?: number;
    focal_length?: string;
    date_original?: string;
    date_taken?: string;
    artist?: string;
    copyright?: string;
    description?: string;
    title?: string;
  };
};

type Props = {
  metadata: ImageMetadata;
  imageSrc: string;
};

type RowData = { label: string; value: string | number };

// Format date from EXIF format (YYYY:MM:DD HH:MM:SS) to readable format
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split(':');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateStr;
  }
};

// Format camera make + model into a single string
const formatCameraFull = (make?: string, model?: string): string => {
  if (!model) return make || '';
  if (!make) return model;
  // If model already contains make, just return model
  if (model.toUpperCase().includes(make.toUpperCase())) return model;
  return `${make} ${model}`;
};

// Format exposure time
const formatExposure = (time?: number): string => {
  if (!time) return '';
  if (time >= 1) return `${time}s`;
  return `1/${Math.round(1/time)}s`;
};

// Format metering mode
const formatMeteringMode = (mode?: number): string => {
  const modes: Record<number, string> = {
    0: 'Unknown',
    1: 'Average',
    2: 'Center-weighted',
    3: 'Spot',
    4: 'Multi-spot',
    5: 'Pattern',
    6: 'Partial',
  };
  return mode !== undefined ? (modes[mode] || `Mode ${mode}`) : '';
};

// Format exposure program
const formatExposureProgram = (program?: number): string => {
  const programs: Record<number, string> = {
    0: 'Not defined',
    1: 'Manual',
    2: 'Program AE',
    3: 'Aperture Priority',
    4: 'Shutter Priority',
    5: 'Creative',
    6: 'Action',
    7: 'Portrait',
    8: 'Landscape',
  };
  return program !== undefined ? (programs[program] || '') : '';
};

// Section component for cleaner rendering
const Section = ({ title, rows }: { title: string; rows: RowData[] }) => {
  const validRows = rows.filter(r => r.value !== '' && r.value !== undefined && r.value !== null);
  if (validRows.length === 0) return null;
  
  return (
    <div className="info-panel-section">
      <div className="info-panel-section-title">{title}</div>
      <div className="info-panel-details">
        {validRows.map((row, i) => (
          <div className="info-panel-row" key={i}>
            <span className="info-panel-label">{row.label}</span>
            <span className="info-panel-value">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function InfoPanel({ metadata, imageSrc }: Props) {
  const photo = metadata.photography || {};
  const exif = metadata.exif || {};
  
  const cameraFull = formatCameraFull(photo.camera_make, photo.camera_model);
  const dateFormatted = formatDate(photo.date_original || exif.DateTimeOriginal);
  const timeOriginal = exif.DateTimeOriginal?.split(' ')[1] || '';

  const handleCRClick = () => {
    openC2PAOverlay(imageSrc);
  };

  // Build section data
  const fileRows: RowData[] = [
    { label: 'File', value: metadata.filename || '' },
    { label: 'Format', value: metadata.format || '' },
    { label: 'Dimensions', value: (metadata.width && metadata.height) ? `${metadata.width} × ${metadata.height}` : '' },
  ];

  const cameraRows: RowData[] = [
    { label: 'Camera', value: cameraFull },
    { label: 'Lens', value: photo.lens_model || '' },
    { label: 'Body S/N', value: exif.BodySerialNumber || '' },
    { label: 'Lens S/N', value: exif.LensSerialNumber || '' },
  ];

  const exposureRows: RowData[] = [
    { label: 'Focal Length', value: photo.focal_length ? `${photo.focal_length}${exif.FocalLengthIn35mmFilm ? ` (${exif.FocalLengthIn35mmFilm}mm eq.)` : ''}` : '' },
    { label: 'Aperture', value: photo.aperture || (exif.FNumber ? `f/${exif.FNumber}` : '') },
    { label: 'Shutter', value: photo.shutter_speed || formatExposure(exif.ExposureTime) },
    { label: 'ISO', value: photo.iso || exif.ISOSpeedRatings || '' },
    { label: 'Exp. Bias', value: exif.ExposureBiasValue ? (exif.ExposureBiasValue > 0 ? `+${exif.ExposureBiasValue} EV` : `${exif.ExposureBiasValue} EV`) : '' },
    { label: 'Program', value: formatExposureProgram(exif.ExposureProgram) },
    { label: 'Metering', value: formatMeteringMode(exif.MeteringMode) },
  ];

  const captureRows: RowData[] = [
    { label: 'Date', value: dateFormatted },
    { label: 'Time', value: timeOriginal ? `${timeOriginal}${exif.OffsetTime ? ` (${exif.OffsetTime})` : ''}` : '' },
  ];

  const processingRows: RowData[] = [
    { label: 'Software', value: exif.Software || '' },
    { label: 'Color Space', value: exif.ColorSpace === 1 ? 'sRGB' : (exif.ColorSpace ? `${exif.ColorSpace}` : '') },
    { label: 'Resolution', value: (exif.XResolution && exif.YResolution) ? `${exif.XResolution} × ${exif.YResolution} ${exif.ResolutionUnit === 2 ? 'DPI' : 'DPCM'}` : '' },
  ];

  const creditRows: RowData[] = [
    { label: 'Artist', value: photo.artist || '' },
    { label: 'Copyright', value: photo.copyright || '' },
  ];

  return (
    <div className="carousel-info-panel">
      {/* Header */}
      <div className="info-panel-header">
        <span className="info-panel-title">Image Info</span>
      </div>

      {/* Description/Caption */}
      {photo.description && (
        <p className="info-panel-description">{photo.description}</p>
      )}

      {/* Sections */}
      <Section title="File" rows={fileRows} />
      <Section title="Camera" rows={cameraRows} />
      <Section title="Exposure" rows={exposureRows} />
      <Section title="Capture" rows={captureRows} />
      <Section title="Processing" rows={processingRows} />
      <Section title="Credits" rows={creditRows} />

      {/* C2PA Content Credentials button */}
      <button 
        className="c2pa-indicator info-panel-cr-button"
        onClick={handleCRClick}
        aria-label="View Content Credentials"
      >
        <span dangerouslySetInnerHTML={{ __html: CR_LOGO_SVG }} />
        <span className="c2pa-indicator-label">content credentials</span>
      </button>
    </div>
  );
}
