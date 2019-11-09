import './proj4';
import Highcharts from 'highcharts';
import HighchartsMap from 'highcharts/modules/map';

import mapData from '@highcharts/map-collection/countries/us/us-all.geo.json';

if (typeof window !== 'undefined') {
  HighchartsMap(Highcharts);
  Highcharts.maps['countries/us/us-all'] = mapData;
}

export default Highcharts;