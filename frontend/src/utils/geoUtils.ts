/**
 * Point in Polygon Algorithm (Ray-Casting)
 * @param point { lat, lng }
 * @param polygon Array of { lat, lng }
 * @returns boolean true if point is inside the polygon
 */
export const isPointInPolygon = (point: { lat: number, lng: number }, polygon: { lat: number, lng: number }[]) => {
 if (!polygon || polygon.length < 3) return false;

 let isInside = false;
 let j = polygon.length - 1;

 for (let i = 0; i < polygon.length; i++) {
 const xi = polygon[i].lng;
 const yi = polygon[i].lat;
 const xj = polygon[j].lng;
 const yj = polygon[j].lat;

 // Ray casting algorithm
 const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
 (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
 
 if (intersect) isInside = !isInside;
 j = i;
 }

 return isInside;
};
