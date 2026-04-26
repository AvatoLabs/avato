import React from 'react';

import type { RootStackScreenProps } from '../navigation/types';
import ContentScreen from './ContentScreen';

export default function PortalContentScreen({
  navigation,
  route,
}: RootStackScreenProps<'PortalContent'>) {
  return <ContentScreen navigation={navigation as never} route={route as never} />;
}
