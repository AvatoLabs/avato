import { type SwitchProps } from 'antd';
import { Switch } from 'antd';
import { memo, useEffect, useState } from 'react';

interface InstantSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => Promise<void>;
  size?: SwitchProps['size'];
}

const InstantSwitch = memo<InstantSwitchProps>(({ enabled, onChange, size }) => {
  const [value, setValue] = useState(enabled);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setValue(enabled);
  }, [enabled]);

  return (
    <Switch
      loading={loading}
      size={size}
      value={value}
      onChange={async (enabled) => {
        const previousValue = value;
        setLoading(true);
        setValue(enabled);
        try {
          await onChange(enabled);
        } catch {
          setValue(previousValue);
        } finally {
          setLoading(false);
        }
      }}
    />
  );
});

export default InstantSwitch;
