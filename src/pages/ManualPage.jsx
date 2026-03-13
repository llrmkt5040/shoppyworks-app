import React from 'react';

export default function ManualPage() {
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <iframe
        src="/manual.html"
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="操作マニュアル"
      />
    </div>
  );
}
