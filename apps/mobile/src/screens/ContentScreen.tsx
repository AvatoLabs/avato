import ResourceContentOverlays from '../components/ui/ResourceContentOverlays';
import ResourceContentPage from '../components/ui/ResourceContentPage';
import {
  useResourceContentScreen,
  type UseResourceContentScreenProps,
} from '../hooks/useResourceContentScreen';
import type { MainTabScreenProps } from '../navigation/types';

function ContentScreenImpl(props: UseResourceContentScreenProps) {
  const { overlayProps, pageProps } = useResourceContentScreen(props);

  return (
    <ResourceContentPage {...pageProps}>
      <ResourceContentOverlays {...overlayProps} />
    </ResourceContentPage>
  );
}

export default function ContentScreen({ navigation, route }: MainTabScreenProps<'Content'>) {
  return (
    <ContentScreenImpl
      navigation={navigation as UseResourceContentScreenProps['navigation']}
      route={route as UseResourceContentScreenProps['route']}
    />
  );
}
