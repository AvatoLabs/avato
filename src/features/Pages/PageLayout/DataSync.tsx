import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { usePageStore } from '@/store/docs';

const DataSync = () => {
  const navigate = useNavigate();

  useEffect(() => {
    usePageStore.setState({ navigate });

    return () => {
      usePageStore.setState({ navigate: undefined });
    };
  }, [navigate]);

  return null;
};

export default DataSync;
