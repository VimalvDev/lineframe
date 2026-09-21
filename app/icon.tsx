import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          border: '16px solid #262626',
          borderRadius: '128px',
        }}
      >
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ width: 80, height: 240, background: '#3b82f6', borderRadius: '40px' }} />
          <div style={{ width: 80, height: 160, background: '#d4d4d4', borderRadius: '40px', marginTop: 80 }} />
          <div style={{ width: 80, height: 200, background: '#525252', borderRadius: '40px', marginTop: 40 }} />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
