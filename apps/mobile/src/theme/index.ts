import { DarkTheme, DefaultTheme } from '@react-navigation/native';

export const MinkLightTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: '#007aff',
        background: '#E6F4FE',
        card: '#ffffff',
        text: '#1f1f1f',
        border: '#d9d9d9',
        notification: '#ff3b30',
    },
};

export const MinkDarkTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        primary: '#0a84ff',
        background: '#000000',
        card: '#1c1c1e',
        text: '#f0f0f0',
        border: '#424242',
        notification: '#ff453a',
    },
};
