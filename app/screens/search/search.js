// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {injectIntl, intlShape} from 'react-intl';
import {
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableHighlight,
    TouchableOpacity,
    View
} from 'react-native';
import IonIcon from 'react-native-vector-icons/Ionicons';

import {General} from 'mattermost-redux/constants';

import Autocomplete from 'app/components/autocomplete';
import Loading from 'app/components/loading';
import Post from 'app/components/post';
import SectionList from 'app/components/scrollable_section_list';
import SearchBar from 'app/components/search_bar';
import SearchPreview from 'app/components/search_preview';
import StatusBar from 'app/components/status_bar';
import {ViewTypes} from 'app/constants';
import {preventDoubleTap} from 'app/utils/tap';
import {changeOpacity, makeStyleSheetFromTheme} from 'app/utils/theme';

const SECTION_HEIGHT = 20;
const RECENT_LABEL_HEIGHT = 42;
const RECENT_SEPARATOR_HEIGHT = 3;
const POSTS_PER_PAGE = ViewTypes.POST_VISIBILITY_CHUNK_SIZE;
const SEARCHING = 'searching';

class Search extends Component {
    static propTypes = {
        actions: PropTypes.shape({
            clearSearch: PropTypes.func.isRequired,
            getPostsAfter: PropTypes.func.isRequired,
            getPostsBefore: PropTypes.func.isRequired,
            getPostThread: PropTypes.func.isRequired,
            handleSearchDraftChanged: PropTypes.func.isRequired,
            loadThreadIfNecessary: PropTypes.func.isRequired,
            removeSearchTerms: PropTypes.func.isRequired,
            searchPosts: PropTypes.func.isRequired,
            selectPost: PropTypes.func.isRequired
        }).isRequired,
        channels: PropTypes.array.isRequired,
        currentTeamId: PropTypes.string.isRequired,
        currentChannelId: PropTypes.string.isRequired,
        intl: intlShape.isRequired,
        navigator: PropTypes.object,
        posts: PropTypes.array,
        recent: PropTypes.array.isRequired,
        searching: PropTypes.bool,
        theme: PropTypes.object.isRequired
    };

    static defaultProps = {
        posts: []
    };

    constructor(props) {
        super(props);

        props.navigator.setOnNavigatorEvent(this.onNavigatorEvent);
        this.state = {
            channelName: '',
            isFocused: true,
            postId: null,
            preview: false,
            value: ''
        };
    }

    componentDidMount() {
        this.refs.searchBar.focus();
    }

    shouldComponentUpdate(nextProps, nextState) {
        return (
            this.props.recent !== nextProps.recent ||
            this.props.posts !== nextProps.posts ||
            this.state !== nextState
        );
    }

    componentDidUpdate() {
        const {posts, recent} = this.props;
        const recentLenght = recent.length;

        if (posts.length && !this.state.isFocused) {
            setTimeout(() => {
                this.refs.list.getWrapperRef().getListRef().scrollToOffset({
                    animated: true,
                    offset: SECTION_HEIGHT + (recentLenght * RECENT_LABEL_HEIGHT) + ((recentLenght - 1) * RECENT_SEPARATOR_HEIGHT)
                });
            }, 200);
        }
    }

    attachAutocomplete = (c) => {
        this.autocomplete = c;
    };

    cancelSearch = () => {
        const {navigator} = this.props;
        this.handleTextChanged('');
        navigator.dismissModal({animationType: 'slide-down'});
    };

    goToThread = (post) => {
        const {actions, channels, intl, navigator, theme} = this.props;
        const channelId = post.channel_id;
        const channel = channels.find((c) => c.id === channelId);
        const rootId = (post.root_id || post.id);

        actions.loadThreadIfNecessary(post.root_id);
        actions.selectPost(rootId);

        let title;
        if (channel.type === General.DM_CHANNEL) {
            title = intl.formatMessage({id: 'mobile.routes.thread_dm', defaultMessage: 'Direct Message Thread'});
        } else {
            const channelName = channel.display_name;
            title = intl.formatMessage({id: 'mobile.routes.thread', defaultMessage: '{channelName} Thread'}, {channelName});
        }

        const options = {
            screen: 'Thread',
            title,
            animated: true,
            backButtonTitle: '',
            navigatorStyle: {
                navBarTextColor: theme.sidebarHeaderTextColor,
                navBarBackgroundColor: theme.sidebarHeaderBg,
                navBarButtonColor: theme.sidebarHeaderTextColor,
                screenBackgroundColor: theme.centerChannelBg
            },
            passProps: {
                channelId,
                rootId
            }
        };

        if (Platform.OS === 'android') {
            navigator.showModal(options);
        } else {
            navigator.push(options);
        }
    };

    handleSelectionChange = (event) => {
        if (this.autocomplete) {
            this.autocomplete.handleSelectionChange(event);
        }
    };

    handleTextChanged = (value) => {
        const {actions, posts} = this.props;
        this.setState({value});
        actions.handleSearchDraftChanged(value);

        if (!value && posts.length) {
            actions.clearSearch();
        }
    };

    keyRecentExtractor = (item) => {
        return `recent-${item.terms}`;
    };

    keyPostExtractor = (item) => {
        return `result-${item.id}`;
    };

    onBlur = () => {
        this.setState({isFocused: false});
    };

    onFocus = () => {
        const {posts} = this.props;
        this.setState({isFocused: true});
        if (posts.length) {
            this.refs.list.getWrapperRef().getListRef().scrollToOffset({
                animated: false,
                offset: 0
            });
        }
    };

    onNavigatorEvent = (event) => {
        if (event.id === 'backPress') {
            if (this.state.preview) {
                this.refs.preview.getWrappedInstance().handleClose();
            } else {
                this.props.navigator.dismissModal();
            }
        }
    };

    previewPost = (post) => {
        const {actions, channels} = this.props;
        const focusedPostId = post.id;
        const channelId = post.channel_id;

        actions.getPostThread(focusedPostId);
        actions.getPostsBefore(channelId, focusedPostId, 0, POSTS_PER_PAGE);
        actions.getPostsAfter(channelId, focusedPostId, 0, POSTS_PER_PAGE);

        const channel = channels.find((c) => c.id === channelId);
        let displayName = '';

        if (channel) {
            displayName = channel.display_name;
        }

        this.setState({preview: true, postId: focusedPostId, channelName: displayName});
    };

    removeSearchTerms = (item) => {
        const {actions, currentTeamId} = this.props;
        actions.removeSearchTerms(currentTeamId, item.terms);
    };

    renderPost = ({item, index}) => {
        if (item.id === SEARCHING) {
            return (
                <View style={{width: '100%', height: '100%'}}>
                    {item.component}
                </View>
            );
        }

        const {channels, posts, theme} = this.props;
        const style = getStyleFromTheme(theme);

        const channel = channels.find((c) => c.id === item.channel_id);
        let displayName = '';

        if (channel) {
            displayName = channel.display_name;
        }

        let separator;
        if (index === posts.length - 1) {
            separator = this.renderPostSeparator();
        }

        return (
            <View>
                <Text style={style.channelName}>
                    {displayName}
                </Text>
                <Post
                    post={item}
                    renderReplies={true}
                    isFirstReply={false}
                    isLastReply={false}
                    commentedOnPost={null}
                    onPress={this.previewPost}
                    onReply={this.goToThread}
                    isSearchResult={true}
                    shouldRenderReplyButton={true}
                    navigator={this.props.navigator}
                />
                {separator}
            </View>
        );
    };

    renderRecentSeparator = () => {
        const {theme} = this.props;
        const style = getStyleFromTheme(theme);

        return (
            <View style={style.separatorContainer}>
                <View style={style.separator}/>
            </View>
        );
    };

    renderPostSeparator = () => {
        const {theme} = this.props;
        const style = getStyleFromTheme(theme);

        return (
            <View style={[style.separatorContainer, style.postsSeparator]}>
                <View style={style.separator}/>
            </View>
        );
    };

    renderSectionHeader = ({section}) => {
        const {theme} = this.props;
        const {title} = section;
        const style = getStyleFromTheme(theme);

        return (
            <View style={style.sectionWrapper}>
                <View style={style.sectionContainer}>
                    <Text style={style.sectionLabel}>
                        {title}
                    </Text>
                </View>
            </View>
        );
    };

    renderRecentItem = ({item}) => {
        const {theme} = this.props;
        const style = getStyleFromTheme(theme);

        return (
            <TouchableHighlight
                key={item.terms}
                underlayColor={changeOpacity(theme.sidebarTextHoverBg, 0.5)}
                onPress={() => preventDoubleTap(this.setRecentValue, this, item)}
            >
                <View
                    style={style.recentItemContainer}
                >
                    <Text
                        style={style.recentItemLabel}
                    >
                        {item.terms}
                    </Text>
                    <TouchableOpacity
                        onPress={() => preventDoubleTap(this.removeSearchTerms, this, item)}
                        style={style.recentRemove}
                    >
                        <IonIcon
                            name='ios-close-circle-outline'
                            size={20}
                            color={changeOpacity(theme.centerChannelColor, 0.6)}
                        />
                    </TouchableOpacity>
                </View>
            </TouchableHighlight>
        );
    };

    search = (terms, isOrSearch) => {
        const {actions, currentTeamId} = this.props;
        actions.searchPosts(currentTeamId, terms, isOrSearch);
    };

    setRecentValue = (recent) => {
        const {terms, isOrSearch} = recent;
        this.handleTextChanged(terms);
        this.search(terms, isOrSearch);
        this.refs.searchBar.blur();
    };

    handleClosePreview = () => {
        // console.warn('close preview');
        this.setState({preview: false, postId: null});
    };

    handleJumpToChannel = (channelId) => {
        if (channelId) {
            const {actions, channels, currentChannelId} = this.props;
            const {
                handleSelectChannel,
                markChannelAsRead,
                setChannelLoading,
                setChannelDisplayName,
                viewChannel
            } = actions;

            const channel = channels.find((c) => c.id === channelId);
            let displayName = '';

            if (channel) {
                displayName = channel.display_name;
            }

            this.props.navigator.dismissModal({animationType: 'none'});
            setChannelLoading();
            markChannelAsRead(channelId, currentChannelId);
            viewChannel(channelId, currentChannelId);
            setChannelDisplayName(displayName);
            handleSelectChannel(channelId);
        }
    };

    render() {
        const {
            intl,
            navigator,
            posts,
            recent,
            searching,
            theme
        } = this.props;

        const {channelName, postId, preview, value} = this.state;
        const style = getStyleFromTheme(theme);
        const sections = [];

        if (recent.length) {
            sections.push({
                data: recent,
                key: 'recent',
                title: intl.formatMessage({id: 'mobile.search.recentTitle', defaultMessage: 'Recent Searches'}),
                renderItem: this.renderRecentItem,
                keyExtractor: this.keyRecentExtractor,
                ItemSeparatorComponent: this.renderRecentSeparator
            });
        }

        let results;
        if (searching) {
            results = [{
                id: SEARCHING,
                component: <Loading/>
            }];
        } else if (posts.length) {
            results = posts;
        }

        if (results) {
            sections.push({
                data: results,
                key: 'results',
                title: intl.formatMessage({id: 'search_header.results', defaultMessage: 'Search Results'}),
                renderItem: this.renderPost,
                keyExtractor: this.keyPostExtractor,
                ItemSeparatorComponent: this.renderPostSeparator
            });
        }

        let previewComponent;
        if (preview) {
            previewComponent = (
                <SearchPreview
                    ref='preview'
                    channelName={channelName}
                    focusedPostId={postId}
                    navigator={navigator}
                    onClose={this.handleClosePreview}
                    onPress={this.handleJumpToChannel}
                    theme={theme}
                />
            );
        }

        return (
            <View style={{flex: 1}}>
                <StatusBar/>
                <View style={style.header}>
                    <SearchBar
                        ref='searchBar'
                        placeholder={intl.formatMessage({id: 'search_bar.search', defaultMessage: 'Search'})}
                        cancelTitle={intl.formatMessage({id: 'mobile.post.cancel', defaultMessage: 'Cancel'})}
                        backgroundColor='transparent'
                        inputHeight={Platform.OS === 'ios' ? 33 : 46}
                        inputStyle={{
                            backgroundColor: changeOpacity(theme.sidebarHeaderTextColor, 0.2),
                            color: theme.sidebarHeaderTextColor,
                            ...Platform.select({
                                android: {
                                    fontSize: 15
                                },
                                ios: {
                                    fontSize: 13
                                }
                            })
                        }}
                        placeholderTextColor={changeOpacity(theme.sidebarHeaderTextColor, 0.5)}
                        selectionColor={changeOpacity(theme.sidebarHeaderTextColor, 0.5)}
                        tintColorSearch={changeOpacity(theme.sidebarHeaderTextColor, 0.8)}
                        tintColorDelete={changeOpacity(theme.sidebarHeaderTextColor, 0.5)}
                        titleCancelColor={theme.sidebarHeaderTextColor}
                        onChangeText={this.handleTextChanged}
                        onBlur={this.onBlur}
                        onFocus={this.onFocus}
                        onSearchButtonPress={(text) => preventDoubleTap(this.search, this, text)}
                        onCancelButtonPress={() => preventDoubleTap(this.cancelSearch, this)}
                        onSelectionChange={this.handleSelectionChange}
                        autoCapitalize='none'
                        value={value}
                        containerStyle={{padding: 0}}
                        backArrowSize={28}
                    />
                </View>
                <Autocomplete
                    ref={this.attachAutocomplete}
                    onChangeText={this.handleTextChanged}
                    isSearch={true}
                />
                <SectionList
                    ref='list'
                    style={style.sectionList}
                    renderSectionHeader={this.renderSectionHeader}
                    sections={sections}
                    keyboardShouldPersistTaps='handled'
                    stickySectionHeadersEnabled={Platform.OS === 'ios'}
                />
                {previewComponent}
            </View>
        );
    }
}

const getStyleFromTheme = makeStyleSheetFromTheme((theme) => {
    return StyleSheet.create({
        header: {
            backgroundColor: theme.sidebarHeaderBg,
            width: Dimensions.get('window').width,
            ...Platform.select({
                android: {
                    height: 46,
                    justifyContent: 'center'
                },
                ios: {
                    height: 64,
                    paddingTop: 20
                }
            })
        },
        sectionWrapper: {
            backgroundColor: theme.centerChannelBg
        },
        sectionContainer: {
            justifyContent: 'center',
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.07),
            paddingLeft: 16,
            height: SECTION_HEIGHT
        },
        sectionLabel: {
            color: theme.centerChannelColor,
            fontSize: 12,
            fontWeight: '600'
        },
        recentItemContainer: {
            alignItems: 'center',
            flex: 1,
            flexDirection: 'row',
            height: RECENT_LABEL_HEIGHT
        },
        recentItemLabel: {
            color: theme.centerChannelColor,
            fontSize: 14,
            height: 20,
            flex: 1,
            paddingHorizontal: 16
        },
        recentRemove: {
            alignItems: 'center',
            height: RECENT_LABEL_HEIGHT,
            justifyContent: 'center',
            width: 50
        },
        separatorContainer: {
            justifyContent: 'center',
            flex: 1,
            height: RECENT_SEPARATOR_HEIGHT
        },
        postsSeparator: {
            height: 15
        },
        separator: {
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.1),
            height: StyleSheet.hairlineWidth
        },
        channelName: {
            color: changeOpacity(theme.centerChannelColor, 0.8),
            fontSize: 14,
            fontWeight: '600',
            marginTop: 5,
            paddingHorizontal: 16
        },
        sectionList: {
            flex: 1,
            zIndex: -1
        }
    });
});

export default injectIntl(Search);
