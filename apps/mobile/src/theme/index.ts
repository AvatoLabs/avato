import { DarkTheme, DefaultTheme } from '@react-navigation/native';

export const MinkLightTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        primary: '#007aff',
        background: '#ffffff',
        card: '#ffffff',
        text: '#1f1f1f',
        border: 'transparent',
        notification: '#ff3b30',
    },
};

export const MinkDarkTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        primary: '#0a84ff',
        background: '#000000',
        card: '#000000',
        text: '#f0f0f0',
        border: 'transparent',
        notification: '#ff453a',
    },
};
