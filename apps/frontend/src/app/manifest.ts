import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AURA ERP – Sistemas Infotec',
    short_name: 'AURA ERP',
    description: 'Plataforma de gestión integral de implementaciones de software hospitalario',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#060d1c',
    theme_color: '#1E3A5F',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        url: '/dashboard',
        description: 'Ver resumen ejecutivo',
      },
      {
        name: 'Proyectos',
        url: '/proyectos',
        description: 'Gestionar proyectos activos',
      },
    ],
  };
}
