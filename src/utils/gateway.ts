/**
 * Utility for dynamic gateway routing mapping public municipal scopes and city centers
 * to their closest regional edge gateway nodes.
 */
export function getGatewayNode(city: string | null | undefined): string {
  if (!city) return 'GW-MUMBAI-04';
  
  const cleanCity = city.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleanCity) return 'GW-MUMBAI-04';

  const routingMap: Record<string, string> = {
    MUMBAI: 'GW-MUMBAI-04',
    CHENNAI: 'GW-CHENNAI-02',
    DELHI: 'GW-DELHI-03',
    BANGALORE: 'GW-BENGALURU-05',
    BENGALURU: 'GW-BENGALURU-05',
    KOLKATA: 'GW-KOLKATA-01',
    HYDERABAD: 'GW-HYDERABAD-06',
    PUNE: 'GW-PUNE-07',
    AHMEDABAD: 'GW-AHMEDABAD-09',
    JAIPUR: 'GW-JAIPUR-10',
  };

  return routingMap[cleanCity] || `GW-${cleanCity}-08`;
}
