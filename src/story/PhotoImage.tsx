import type { CSSProperties } from 'react';
import type { Photo } from '../model/types';
import { usePhotoUrl, type ImageSize } from '../lib/images';
import { useStory } from './context';

interface Props {
  photo: Photo;
  size?: ImageSize;
  className?: string;
  style?: CSSProperties;
  /** Kitölti a szülőt (object-cover); különben a kép saját arányát tartja. */
  cover?: boolean;
  eager?: boolean;
  alt?: string;
}

/** Kép a helyére foglalt arányos dobozzal, így betöltéskor nem ugrál az oldal. */
export function PhotoImage({ photo, size = 'display', className = '', style, cover, eager, alt }: Props) {
  const { projectId } = useStory();
  const url = usePhotoUrl(projectId, photo, size);
  const ratio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : '4 / 3';
  return (
    <div
      className={`relative overflow-hidden bg-soft ${cover ? 'h-full w-full' : ''} ${className}`}
      style={cover ? style : { aspectRatio: ratio, ...style }}
    >
      {url ? (
        <img
          src={url}
          alt={alt ?? photo.caption ?? ''}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          onLoad={(e) => (e.currentTarget.style.opacity = '1')}
          style={{ opacity: 0 }}
        />
      ) : (
        <div className="skeleton absolute inset-0" />
      )}
    </div>
  );
}
