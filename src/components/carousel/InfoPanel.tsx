import { CR_LOGO_SVG } from "../icons/cr-logo-svg";

type ImageMetadata = {
  camera_make?: string;
  camera_model?: string;
  lens_model?: string;
  aperture?: string;
  shutter_speed?: string;
  iso?: number;
  focal_length?: string;
  date_original?: string;
  artist?: string;
  copyright?: string;
  description?: string;
  title?: string;
};

type Props = {
  metadata: ImageMetadata;
  imageSrc: string;
};

// Format date from EXIF format (YYYY:MM:DD HH:MM:SS) to readable format
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const [datePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split(':');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return dateStr;
  }
};

// Format camera info
const formatCamera = (make?: string, model?: string): string => {
  if (!model) return '';
  const cleanModel = make && model.includes(make) 
    ? model.replace(make, '').trim() 
    : model;
  return cleanModel;
};

export default function InfoPanel({ metadata, imageSrc }: Props) {
  const camera = formatCamera(metadata.camera_make, metadata.camera_model);
  const date = formatDate(metadata.date_original);
  
  const specs = [
    metadata.focal_length,
    metadata.aperture,
    metadata.shutter_speed,
    metadata.iso ? `ISO ${metadata.iso}` : null
  ].filter(Boolean).join(' · ');

  const handleCRClick = () => {
    // Dispatch the same event that C2PAOverlay listens for
    window.dispatchEvent(new CustomEvent('open-c2pa', { 
      detail: { imgSrc: imageSrc } 
    }));
  };

  return (
    <div className="carousel-info-panel">
      {/* Header */}
      <div className="info-panel-header">
        <span className="info-panel-title">Metadata</span>
      </div>

      {/* Description/Caption */}
      {metadata.description && (
        <p className="info-panel-description">{metadata.description}</p>
      )}

      {/* Technical details */}
      <div className="info-panel-details">
        {camera && (
          <div className="info-panel-row">
            <span className="info-panel-label">Camera</span>
            <span className="info-panel-value">{camera}</span>
          </div>
        )}
        {metadata.lens_model && (
          <div className="info-panel-row">
            <span className="info-panel-label">Lens</span>
            <span className="info-panel-value">{metadata.lens_model}</span>
          </div>
        )}
        {specs && (
          <div className="info-panel-row">
            <span className="info-panel-label">Settings</span>
            <span className="info-panel-value">{specs}</span>
          </div>
        )}
        {date && (
          <div className="info-panel-row">
            <span className="info-panel-label">Date</span>
            <span className="info-panel-value">{date}</span>
          </div>
        )}
      </div>

      {/* Copyright */}
      {metadata.copyright && (
        <div className="info-panel-copyright">{metadata.copyright}</div>
      )}

      {/* C2PA Content Credentials button - uses existing c2pa-indicator styles */}
      <button 
        className="c2pa-indicator info-panel-cr-button"
        onClick={handleCRClick}
        aria-label="View Content Credentials"
        dangerouslySetInnerHTML={{
          __html: `${CR_LOGO_SVG}<span class="c2pa-indicator-label">content credentials</span>`
        }}
      />
    </div>
  );
}
