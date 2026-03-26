import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import CategoryContainer from '../../components/CategoryContainer';

const styles = createStaticStyles(({ css }) => ({
  mainContainer: css`
    position: relative;
  `,
}));

interface CategoryLayoutProps {
  category: ReactNode;
}

const CategoryLayout = ({ category }: CategoryLayoutProps) => {
  return (
    <Flexbox horizontal className={styles.mainContainer} gap={24} width={'100%'}>
      <CategoryContainer>{category}</CategoryContainer>
      <Flexbox flex={1} gap={16}>
        <Outlet />
      </Flexbox>
    </Flexbox>
  );
};

export default CategoryLayout;
