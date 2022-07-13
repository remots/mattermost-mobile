// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {ScrollView} from 'react-native';
import {Edge, SafeAreaView} from 'react-native-safe-area-context';

import {useTheme} from '@context/theme';
import {makeStyleSheetFromTheme} from '@utils/theme';

const edges: Edge[] = ['left', 'right'];

const getStyleSheet = makeStyleSheetFromTheme((theme) => {
    return {
        container: {
            flex: 1,
            backgroundColor: theme.centerChannelBg,
        },
        scrollView: {
            flex: 1,
        },
        contentContainerStyle: {
            marginTop: 20,
        },
    };
});

type SettingContainerProps = {
   children: React.ReactNode;
}
const SettingContainer = ({children}: SettingContainerProps) => {
    const theme = useTheme();
    const styles = getStyleSheet(theme);

    return (
        <SafeAreaView
            edges={edges}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.contentContainerStyle}
                alwaysBounceVertical={false}
            >
                {children}
            </ScrollView>
        </SafeAreaView>
    );
};

export default SettingContainer;
