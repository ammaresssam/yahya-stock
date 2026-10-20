import { site } from '../data/site'

export const waLink = (text) =>
  `https://wa.me/${site.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`

export const mapsDirections = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(site.mapsQuery)}`
export const mapsEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(site.mapsQuery)}&z=16&output=embed`
