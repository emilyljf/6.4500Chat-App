import { createApp } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiRemote } from "@graffiti-garden/implementation-remote";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";

const focusDirective = {
    mounted(el) {
        el.focus();
    }
};

// const GroupCard = {
//     props: ['group', 'isMember', 'onOpen', 'onJoin', 'onLeave', 'isCreator'],
//     template: `
//         <div class="group-card">
//             <div class="group-image" @click="onOpen(group.value.object)">
//                 <img v-if="group.value.object.image" :src="group.value.object.image" alt="Group image" />
//                 <div v-else class="default-group-image">
//                     {{ (group.value.object.name || 'G').charAt(0).toUpperCase() }}
//                 </div>
//             </div>
//             <div class="group-info">
//                 <h4>{{ group.value.object.name || 'Unnamed Group' }}</h4>
//                 <button v-if="isMember" @click="onOpen(group.value.object)" class="open-btn">Open</button>
//                 <button v-if="isMember" @click="onLeave(group)" class="leave-btn">Leave</button>
//                 <button v-if="!isMember" @click="onJoin(group.value.object)" class="join-btn">Join</button>
//             </div>
//         </div>
//     `
// };

const GroupCard = {
    props: ['group', 'isMember', 'isCreator', 'onOpen', 'onJoin', 'onLeave', 'unreadCount'],
    template: `
        <div class="group-card">
            <div class="group-image" @click="onOpen(group.value.object)">
                <img v-if="group.value.object.image" :src="group.value.object.image" alt="Group image" />
                <div v-else class="default-group-image">
                    {{ (group.value.object.name || 'G').charAt(0).toUpperCase() }}
                </div>
            </div>
            <div class="group-info">
                <h4>{{ group.value.object.name || 'Unnamed Group' }}</h4>
                <div v-if="unreadCount > 0" class="unread-badge">
                    {{ unreadCount }}
                </div>
                <button v-if="isMember" @click="onOpen(group.value.object)" class="open-btn">Open</button>
                <button v-if="isMember" @click="onLeave(group)" class="leave-btn">Leave</button>
                <button v-if="!isMember" @click="onJoin(group.value.object)" class="join-btn">Join</button>
            </div>
        </div>
    `
};

createApp({
    data() {
        return {
            profileImage: null,
            myMessage: "",
            sending: false,
            creatingGroup: false,
            newGroupName: "",
            newGroupImage: "",
            showCreateGroupModal: false,
            currentView: 'home',
            currentGroup: null,
            editingMessage: null,
            editMessageContent: "",
            forceRefresh: 0,
            messageObjects: [],
            myGroups: [],
            editingGroup: null,
            showRenameModal: false,
            renameGroupName: "",
            showEditGroupModal: false,
            editGroupName: "",
            editGroupImage: "",
            groupChatSchema: {
                type: 'object',
                properties: {
                    value: {
                        type: 'object',
                        required: ['activity', 'object'],
                        properties: {
                            activity: { type: 'string', const: 'Create' },
                            object: {
                                type: 'object',
                                required: ['type', 'name', 'channel'],
                                properties: {
                                    type: { type: 'string', const: 'Group Chat' },
                                    name: { type: 'string' },
                                    channel: { type: 'string' },
                                    image: { type: ['string', 'null'] },
                                    description: { type: ['string', 'null'] }
                                }
                            }
                        }
                    }
                }
            },
            messageSchema: {
                properties: {
                    value: {
                        required: ['content', 'published'],
                        properties: {
                            content: { type: 'string' },
                            published: { type: 'number' }
                        }
                    }
                }
            },
            editingGroupName: false,
            groupNameSchema: {
                properties: {
                    value: {
                        required: ['name', 'describes'],
                        properties: {
                            name: { type: 'string' },
                            describes: { type: 'string' }
                        }
                    }
                }
            },
            groupDiscoverSchema: {
                type: 'object',
                properties: {
                    value: {
                        type: 'object',
                        required: ['activity', 'object'],
                        properties: {
                            activity: { type: 'string', enum: ['Create', 'Join', 'Leave'] },
                            object: {
                                type: 'object',
                                required: ['type', 'channel', 'name'],
                                properties: {
                                    type: { type: 'string', const: 'Group Chat' },
                                    channel: { type: 'string' },
                                    name: { type: 'string' },
                                    image: { type: ['string', 'null'] }
                                }
                            }
                        }
                    }
                }
            },
            profile: null,
            showProfileModal: false,
            editName: "",
            editPronouns: "",
            editBio: "",
            pinnedMessages: [],
            showPinnedDropdown: false,
            pinningMessage: null,
            messageObjects: [],
            isLoadingPins: false,
            pinSchema: {
                properties: {
                    value: {
                        required: ['activity', 'describes', 'published'],
                        properties: {
                            activity: { type: 'string', const: 'Pin' },
                            describes: { type: 'string' },
                            published: { type: 'number' }
                        }
                    }
                }
            },
            pinnedMessageUrls: new Set(),
            messageCache: new Map(),
            myPinnedMessageUrls: new Set(),
            localPinnedState: new Map(),
            lastViewedTimes: {},
            unreadCounts: {},
        };
    },

    computed: {
        isMessagePinned() {
            return (url) => this.localPinnedState.get(url) === true;
        }
    },

    methods: {
        updateLastViewedTime(channel) {
            this.lastViewedTimes[channel] = Date.now();
            this.unreadCounts[channel] = 0;
            this.forceRefresh++;
        },
        getUserInitials(actorUri) {
            try {
                const name = this.getUserName(actorUri);
                if (!name) return 'ME';

                const parts = name.split(' ');

                const initials = parts
                    .filter(part => part.length > 0)
                    .slice(0, 2)
                    .map(part => part.charAt(0).toUpperCase());

                return initials.join('') || 'ME';
            } catch (e) {
                console.error("Error generating initials:", e);
                return 'ME';
            }
        },


        calculateUnreadCounts(objects) {
            if (!this.$graffitiSession.value) return;

            const counts = {};

            // Initialize counts for all known groups
            Object.keys(this.lastViewedTimes).forEach(channel => {
                counts[channel] = 0;
            });

            // Count unread messages
            objects.forEach(obj => {
                if (obj.value?.published && obj.value?.content) {
                    const channel = obj.channels?.[0];
                    if (channel && channel in this.lastViewedTimes) {
                        if (obj.value.published > this.lastViewedTimes[channel]) {
                            counts[channel] = (counts[channel] || 0) + 1;
                        }
                    }
                }
            });

            this.unreadCounts = counts;
        },

        scrollToBottom() {
            const container = this.$refs.messages;
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        },

        // async pinMessage(message, session) {
        //     const messageUrl = message.url;
        //     const actor = session.actor;

        //     try {
        //         const isCurrentlyPinned = this.localPinnedState.get(messageUrl) === true;

        //         if (isCurrentlyPinned) {
        //             const pinToDelete = this.pinnedMessages.find(
        //                 pin => pin.value.describes === messageUrl && pin.actor === actor
        //             );
        //             if (pinToDelete) {
        //                 await this.$graffiti.delete(pinToDelete, session);
        //             }
        //         } else {
        //             const pinActivity = {
        //                 value: {
        //                     activity: 'Pin',
        //                     describes: messageUrl,
        //                     published: Date.now()
        //                 },
        //                 channels: [this.currentGroup.channel]
        //             };
        //             await this.$graffiti.put(pinActivity, session);
        //         }

        //         this.localPinnedState.set(messageUrl, !isCurrentlyPinned);
        //         this.forceRefresh++;
        //         this.$forceUpdate();

        //         await this.loadPinnedMessages();


        //     } catch (error) {
        //         console.error("Pin operation failed:", error);
        //     }
        // },
        async pinMessage(message, session) {
            const messageUrl = message.url;
            const actor = session.actor;

            const container = this.$refs.messages;
            const scrollTopBefore = container?.scrollTop ?? 0;

            try {
                const isCurrentlyPinned = this.localPinnedState.get(messageUrl) === true;

                if (isCurrentlyPinned) {
                    const pinToDelete = this.pinnedMessages.find(
                        pin => pin.value.describes === messageUrl && pin.actor === actor
                    );
                    if (pinToDelete) {
                        await this.$graffiti.delete(pinToDelete, session);
                    }
                } else {
                    const pinActivity = {
                        value: {
                            activity: 'Pin',
                            describes: messageUrl,
                            published: Date.now()
                        },
                        channels: [this.currentGroup.channel]
                    };
                    await this.$graffiti.put(pinActivity, session);
                }

                this.localPinnedState.set(messageUrl, !isCurrentlyPinned);


                await this.loadPinnedMessages();

                this.$nextTick(() => {
                    if (container) {
                        container.scrollTop = scrollTopBefore;
                    }
                });

            } catch (error) {
                console.error("Pin operation failed:", error);
            }
        },

        async unpinMessage(pin) {
            try {
                await this.$graffiti.delete(pin, this.$graffitiSession.value);

                this.localPinnedState.set(pin.value.describes, false);

                this.forceRefresh++;
                await this.loadPinnedMessages();
                this.$forceUpdate();
            } catch (error) {
                console.error("Failed to unpin:", error);
            }
        },
        async loadPinnedMessages() {
            if (!this.currentGroup?.channel) return;

            this.isLoadingPins = true;
            try {
                const discovery = await this.$graffiti.discover({
                    schema: this.pinSchema,
                    channels: [this.currentGroup.channel]
                });

                this.pinnedMessages = (discovery.objects || [])
                    .sort((a, b) => b.value.published - a.value.published);

                this.pinnedMessageUrls = new Set(
                    this.pinnedMessages.map(pin => pin.value.describes)
                );

                this.pinnedMessages.forEach(pin => {
                    if (!this.messageCache.has(pin.value.describes)) {
                        this.fetchMessage(pin.value.describes);
                    }
                });

            } catch (error) {
                console.error("Failed to load pinned messages:", error);
            } finally {
                this.isLoadingPins = false;
            }
        },

        togglePinnedDropdown() {
            this.showPinnedDropdown = !this.showPinnedDropdown;
            if (this.showPinnedDropdown) {
                this.loadPinnedMessages();
            }
        },


        togglePinnedVisibility() {
            this.showPinned = !this.showPinned;
        },

        findMessageContent(messageUrl) {
            const message = this.messageObjects.find(m => m.url === messageUrl);
            if (message) return message.value.content;

            if (this.messageCache.has(messageUrl)) {
                return this.messageCache.get(messageUrl);
            }

            this.fetchMessage(messageUrl);
            return "Loading...";
        },

        async fetchMessage(messageUrl) {
            try {
                const response = await this.$graffiti.get(messageUrl, { schema: this.messageSchema });
                if (response?.value?.content) {
                    this.messageCache.set(messageUrl, response.value.content);
                    this.$forceUpdate();
                } else {
                    this.messageCache.set(messageUrl, "[Message not available]");
                    this.$forceUpdate();
                }
            } catch (error) {
                console.error('Failed to fetch message:', error);
                this.messageCache.set(messageUrl, "[Message not available]");
                this.$forceUpdate();
            }
        },

        async sendMessage(session) {
            if (!this.myMessage || !this.currentGroup) return;

            this.sending = true;

            try {
                await this.$graffiti.put(
                    {
                        value: {
                            content: this.myMessage,
                            published: Date.now(),
                        },
                        channels: [this.currentGroup.channel],
                    },
                    session,
                );
                this.myMessage = "";
                // this.scrollToBottom(); 
                this.$nextTick(() => {
                    setTimeout(this.scrollToBottom, 50);
                });

            } catch (error) {
                console.error("Failed to send message:", error);
            } finally {
                this.sending = false;
                await this.$nextTick();
                this.$refs.messageInput?.focus();
            }
        },

        // async createGroupChat(session) {
        //     if (!this.newGroupName) return;

        //     this.creatingGroup = true;

        //     try {
        //         const newChannel = `group:${crypto.randomUUID()}`;
        //         const newGroup = {
        //             value: {
        //                 activity: 'Create',
        //                 object: {
        //                     type: 'Group Chat',
        //                     name: this.newGroupName,
        //                     channel: newChannel,
        //                     image: this.newGroupImage || null,
        //                     description: this.newGroupDescription || ''
        //                 }
        //             },
        //             channels: ["designftw"]
        //         };

        //         await this.$graffiti.put(newGroup, session);

        //         this.myGroups.push(newChannel);

        //         this.newGroupName = "";
        //         this.newGroupImage = "";
        //         this.newGroupDescription = "";
        //         this.showCreateGroupModal = false;

        //         this.forceRefresh++;

        //     } catch (error) {
        //         console.error("Failed to create group:", error);
        //         alert("Failed to create group. Please try again.");
        //     } finally {
        //         this.creatingGroup = false;
        //     }
        // },
        // async createGroupChat(session) {
        //     if (!this.newGroupName) return;

        //     this.creatingGroup = true;

        //     try {
        //         const discovery = await this.$graffiti.discover({
        //             schema: this.groupDiscoverSchema,
        //             channels: ['designftw']
        //         });

        //         const discoveredObjects = discovery.objects || [];

        //         // De-duplicate by channel
        //         const uniqueGroupsByChannel = new Map();
        //         for (const obj of discoveredObjects) {
        //             const channel = obj.value.object?.channel;
        //             if (channel && !uniqueGroupsByChannel.has(channel)) {
        //                 uniqueGroupsByChannel.set(channel, obj);
        //             }
        //         }

        //         // Check for duplicate name (case-insensitive)
        //         const lowerNewName = this.newGroupName.trim().toLowerCase();
        //         for (const obj of uniqueGroupsByChannel.values()) {
        //             const existingName = obj.value.object?.name?.trim().toLowerCase();
        //             if (existingName === lowerNewName) {
        //                 alert("A group with this name already exists. Please choose a different name.");
        //                 this.creatingGroup = false;
        //                 return;
        //             }
        //         }

        //         const newChannel = `group:${crypto.randomUUID()}`;
        //         const newGroup = {
        //             value: {
        //                 activity: 'Create',
        //                 object: {
        //                     type: 'Group Chat',
        //                     name: this.newGroupName,
        //                     channel: newChannel,
        //                     image: this.newGroupImage || null,
        //                     description: this.newGroupDescription || ''
        //                 }
        //             },
        //             channels: ["designftw"]
        //         };

        //         await this.$graffiti.put(newGroup, session);

        //         // Log Join activity
        //         await this.$graffiti.put({
        //             value: {
        //                 activity: 'Join',
        //                 object: {
        //                     type: 'Group Chat',
        //                     name: this.newGroupName,
        //                     channel: newChannel,
        //                     image: this.newGroupImage || null
        //                 }
        //             },
        //             channels: ['designftw']
        //         }, session);

        //         this.myGroups.push(newChannel);
        //         this.newGroupName = "";
        //         this.newGroupImage = "";
        //         this.newGroupDescription = "";
        //         this.showCreateGroupModal = false;
        //         this.forceRefresh++;

        //     } catch (error) {
        //         console.error("Failed to create group:", error);
        //         alert("Failed to create group. Please try again.");
        //     } finally {
        //         this.creatingGroup = false;
        //     }
        // },        
        async createGroupChat(session) {
            if (!this.newGroupName) return;

            this.creatingGroup = true;

            try {
                const discovery = await this.$graffiti.discover({
                    schema: this.groupDiscoverSchema,
                    channels: ['designftw']
                });

                const discoveredObjects = discovery.objects || [];

                console.log("Discovered group objects:");
                discoveredObjects.forEach(obj => {
                    const activity = obj.value?.activity;
                    const name = obj.value?.object?.name;
                    const channel = obj.value?.object?.channel;
                    console.log(`Activity: ${activity}, Name: ${name}, Channel: ${channel}, URL: ${obj.url}`);
                });

                // Track latest 'Create' per channel (deduplicated by channel using highest URL)
                const latestCreates = new Map();

                for (const obj of discoveredObjects) {
                    const activity = obj.value?.activity;
                    const channel = obj.value?.object?.channel;

                    if (activity === 'Create' && channel) {
                        const existing = latestCreates.get(channel);
                        if (!existing || obj.url > existing.url) {
                            latestCreates.set(channel, obj);
                        }
                    }
                }

                const lowerNewName = this.newGroupName.trim().toLowerCase();

                for (const obj of latestCreates.values()) {
                    const existingName = obj.value?.object?.name?.trim().toLowerCase();
                    console.log("Checking against group name:", existingName);
                    if (existingName === lowerNewName) {
                        alert("A group with this name already exists. Please choose a different name.");
                        this.creatingGroup = false;
                        return;
                    }
                }

                const newChannel = `group:${crypto.randomUUID()}`;
                const newGroup = {
                    value: {
                        activity: 'Create',
                        object: {
                            type: 'Group Chat',
                            name: this.newGroupName,
                            channel: newChannel,
                            image: this.newGroupImage || null,
                            description: this.newGroupDescription || ''
                        }
                    },
                    channels: ['designftw']
                };

                await this.$graffiti.put(newGroup, session);

                await this.$graffiti.put({
                    value: {
                        activity: 'Join',
                        object: {
                            type: 'Group Chat',
                            name: this.newGroupName,
                            channel: newChannel,
                            image: this.newGroupImage || null
                        }
                    },
                    channels: ['designftw']
                }, session);

                this.myGroups.push(newChannel);
                this.newGroupName = "";
                this.newGroupImage = "";
                this.newGroupDescription = "";
                this.showCreateGroupModal = false;
                this.forceRefresh++;

            } catch (error) {
                console.error("Failed to create group:", error);
                alert("Failed to create group. Please try again.");
            } finally {
                this.creatingGroup = false;
            }
        },

        // async enterGroup(group) {
        //     this.currentGroup = {
        //         name: group.name || 'Unnamed Group',
        //         channel: group.channel,
        //         image: group.image || null,
        //         creator: group.actor
        //     };
        //     this.currentView = 'group';
        //     this.myMessage = "";

        //     const alreadyJoined = this.myGroups.includes(group.channel);
        //     if (!alreadyJoined) {
        //         const joinObject = {
        //             value: {
        //                 activity: 'Join',
        //                 object: {
        //                     type: 'Group Chat',
        //                     name: group.name || 'Unnamed Group',
        //                     channel: group.channel,
        //                     image: group.image || null
        //                 }
        //             },
        //             channels: ['designftw']
        //         };

        //         try {
        //             await this.$graffiti.put(joinObject, this.$graffitiSession.value);
        //             this.myGroups.push(group.channel);
        //         } catch (error) {
        //             console.error("Join PUT failed:", error);
        //         }
        //     }

        //     this.forceRefresh++;

        //     this.$nextTick(() => {
        //         setTimeout(this.scrollToBottom, 100);
        //     });
        // },

        async enterGroup(group) {
            this.updateLastViewedTime(group.channel);
            this.currentGroup = {
                name: group.name || 'Unnamed Group',
                channel: group.channel,
                image: group.image || null,
                creator: group.actor
            };
            this.currentView = 'group';
            this.myMessage = "";

            const alreadyJoined = this.myGroups.includes(group.channel);
            if (!alreadyJoined) {
                const joinObject = {
                    value: {
                        activity: 'Join',
                        object: {
                            type: 'Group Chat',
                            name: group.name || 'Unnamed Group',
                            channel: group.channel,
                            image: group.image || null
                        }
                    },
                    channels: ['designftw']
                };

                try {
                    await this.$graffiti.put(joinObject, this.$graffitiSession.value);
                    this.myGroups.push(group.channel);
                } catch (error) {
                    console.error("Join PUT failed:", error);
                }
            }

            this.forceRefresh++;

            // await this.loadPinnedMessages();

            this.$nextTick(() => {
                setTimeout(this.scrollToBottom, 100);
            });
        },


        returnHome() {
            this.currentView = 'home';
            this.currentGroup = null;
            this.myMessage = "";
            this.forceRefresh++;
        },

        async deleteMessage(message, session) {
            if (confirm("Are you sure you want to delete this message?")) {
                try {
                    await this.$graffiti.delete(message, session);
                } catch (error) {
                    console.error("Failed to delete message:", error);
                }
            }
        },

        startEditing(url, content) {
            this.editingMessage = url;
            this.editMessageContent = content;
            this.$nextTick(() => {
                this.$refs.editInput?.focus();
            });
        },

        cancelEditing() {
            this.editingMessage = null;
            this.editMessageContent = "";
        },

        async finishEditing(message, session) {
            if (!this.editMessageContent.trim()) {
                this.cancelEditing();
                return;
            }

            try {
                await this.$graffiti.patch(
                    {
                        value: [
                            { op: "replace", path: "/content", value: this.editMessageContent },
                            { op: "replace", path: "/published", value: Date.now() }
                        ]
                    },
                    message,
                    session
                );
                this.cancelEditing();
            } catch (error) {
                console.error("Failed to update message:", error);
                alert("Failed to update message. Please try again.");
            }
        },
        // handlePinsDiscovered({ objects }) {
        //     this.pinnedMessages = objects.sort((a, b) => b.value.published - a.value.published);

        //     this.pinnedMessages.forEach(pin => {
        //         this.localPinnedState.set(pin.value.describes, true);
        //         if (!this.messageCache.has(pin.value.describes)) {
        //             this.fetchMessage(pin.value.describes);
        //         }
        //     });

        //     const currentPinUrls = new Set(objects.map(p => p.value.describes));
        //     Array.from(this.localPinnedState.keys()).forEach(url => {
        //         if (!currentPinUrls.has(url)) {
        //             this.localPinnedState.delete(url);
        //         }
        //     });

        //     this.pinnedMessageUrls = new Set(currentPinUrls);
        //     this.forceRefresh++;
        //     this.$forceUpdate();
        // },

        async handleTogglePin(message) {
            const messageUrl = message.url;
            const actor = this.$graffitiSession.value.actor;

            try {
                const createObjects = discoveredObjects.filter(obj =>
                    obj.value?.activity === 'Create' &&
                    obj.value?.object?.type === 'Group Chat' &&
                    typeof obj.value?.object?.name === 'string'
                );

                const pins = discovery?.objects || [];
                const matchingPin = pins.find(
                    pin => {
                        const match = pin.value.describes === messageUrl && pin.actor === this.$graffitiSession.value.actor;
                        console.log('Comparing pin.actor:', pin.actor, '===', this.$graffitiSession.value.actor, '=>', match);
                        return match;
                    }
                );



                if (matchingPin) {
                    await this.unpinMessage(matchingPin);
                } else {
                    const pinActivity = {
                        value: {
                            activity: 'Pin',
                            describes: messageUrl,
                            published: Date.now()
                        },
                        channels: [this.currentGroup.channel]
                    };
                    await this.$graffiti.put(pinActivity, this.$graffitiSession.value);
                    this.localPinnedState.set(messageUrl, true);
                    await this.loadPinnedMessages();
                }

                this.forceRefresh++;
                this.$forceUpdate();

            } catch (err) {
                console.error("Error in handleTogglePin:", err);
            }
        },
        // async handleTogglePin(message) {
        //     const messageUrl = message.url;
        //     const actor = this.$graffitiSession.value.actor;

        //     try {
        //         const discovery = await this.$graffiti.discover({
        //             schema: this.pinSchema,
        //             channels: [this.currentGroup.channel]
        //         });

        //         const pins = discovery?.objects || [];

        //         const matchingPin = pins.find(
        //             pin => pin.value.describes === messageUrl && pin.actor === actor
        //         );

        //         if (matchingPin) {
        //             await this.unpinMessage(matchingPin);
        //         } else {
        //             await this.pinMessage(message, this.$graffitiSession.value);
        //         }

        //         this.forceRefresh++;        
        //         await this.loadPinnedMessages();  

        //     } catch (err) {
        //         console.error("Error in handleTogglePin:", err);
        //     }
        // },

        handleMessagesDiscovered({ objects }) {
            this.messageObjects = objects.sort((a, b) => a.value.published - b.value.published);
            this.pinnedMessageUrls = new Set(objects.map(pin => pin.value.describes));


            objects.forEach(msg => {
                this.messageCache.set(msg.url, msg.value.content);
            });

            this.$nextTick(this.scrollToBottom);
        },


        async handleTogglePin(message) {
            const messageUrl = message.url;
            const actor = this.$graffitiSession.value.actor;

            try {
                const discovery = await this.$graffiti.discover({
                    schema: this.pinSchema,
                    channels: [this.currentGroup.channel]
                });

                const pins = discovery?.objects || [];

                const matchingPin = pins.find(
                    pin => pin.value.describes === messageUrl && pin.actor === actor
                );

                if (matchingPin) {
                    await this.$graffiti.delete(matchingPin, this.$graffitiSession.value);
                    this.localPinnedState.set(messageUrl, false);
                } else {
                    if (!this.pinnedMessageUrls.has(messageUrl)) {
                        const pinActivity = {
                            value: {
                                activity: 'Pin',
                                describes: messageUrl,
                                published: Date.now()
                            },
                            channels: [this.currentGroup.channel]
                        };
                        await this.$graffiti.put(pinActivity, this.$graffitiSession.value);
                        this.localPinnedState.set(messageUrl, true);
                    }
                }

                this.forceRefresh++;
                await this.loadPinnedMessages();
                this.$forceUpdate();

            } catch (err) {
                console.error("Error in handleTogglePin:", err);
            }
        },

        // handlePinsDiscovered({ objects }) {
        //     // Preserve existing pinned state
        //     const previousPins = new Map(
        //         this.pinnedMessages.map(pin => [pin.value.describes, pin])
        //     );

        //     // Update with new discoveries
        //     this.pinnedMessages = objects.sort((a, b) => b.value.published - a.value.published);

        //     // Sync local state with discovered pins
        //     this.pinnedMessages.forEach(pin => {
        //         this.localPinnedState.set(pin.value.describes, true);
        //         if (!this.messageCache.has(pin.value.describes)) {
        //             this.fetchMessage(pin.value.describes);
        //         }
        //     });

        //     // Remove pins that no longer exist
        //     const currentPinUrls = new Set(objects.map(p => p.value.describes));
        //     Array.from(this.localPinnedState.keys()).forEach(url => {
        //         if (!currentPinUrls.has(url)) {
        //             this.localPinnedState.delete(url);
        //         }
        //     });
        // },
        onGroupsDiscovered({ objects }) {
            if (!this.$graffitiSession.value) return;

            const myActor = this.$graffitiSession.value.actor;
            const channelStates = new Map();

            objects
                .filter(obj => obj.actor === myActor)
                .forEach(obj => {
                    const channel = obj.value.object.channel;
                    const activity = obj.value.activity;
                    if (activity === 'Create' || activity === 'Join') {
                        channelStates.set(channel, true);
                    } else if (activity === 'Leave') {
                        channelStates.set(channel, false);
                    }
                });

            this.myGroups = Array.from(channelStates.entries())
                .filter(([_, joined]) => joined)
                .map(([channel]) => channel);
        },
        openRenameModal() {
            this.renameGroupName = this.currentGroup.name;
            this.showRenameModal = true;
            this.$nextTick(() => {
                this.$refs.renameModalInput?.focus();
            });
        },
        openEditGroupModal() {
            this.editGroupName = this.currentGroup.name || "";
            this.editGroupImage = this.currentGroup.image || "";
            this.showEditGroupModal = true;
        },
        async saveGroupEdits(session) {
            if (!this.editGroupName.trim()) return;

            try {
                await this.$graffiti.put({
                    value: {
                        activity: 'Create',
                        object: {
                            type: 'Group Chat',
                            name: this.editGroupName,
                            image: this.editGroupImage || null,
                            channel: this.currentGroup.channel
                        }
                    },
                    channels: ['designftw']
                }, session);

                this.currentGroup.name = this.editGroupName;
                this.currentGroup.image = this.editGroupImage;
                this.showEditGroupModal = false;
                this.forceRefresh++;
            } catch (error) {
                console.error("Failed to update group info:", error);
                alert("Failed to update group. Try again.");
            }
        },

        async confirmRename(session) {
            if (!this.renameGroupName.trim()) return;

            try {
                await this.$graffiti.put({
                    value: {
                        name: this.renameGroupName,
                        describes: this.currentGroup.channel
                    },
                    channels: [this.currentGroup.channel]
                }, session);

                this.currentGroup.name = this.renameGroupName;
                this.showRenameModal = false;
                this.forceRefresh++;
            } catch (error) {
                console.error("Failed to rename group:", error);
                alert("Failed to rename group. Please try again.");
            }
        },

        async deleteGroup(groupObj) {
            if (!confirm(`Are you sure you want to delete group "${groupObj.value.object.name}"?`)) return;

            try {
                await this.$graffiti.delete(groupObj, this.$graffitiSession.value);
                this.myGroups = this.myGroups.filter(channel => channel !== groupObj.value.object.channel);
                this.forceRefresh++;
            } catch (err) {
                console.error("Failed to delete group:", err);
                alert("Failed to delete group.");
            }
        },


        filteredMyGroups(objects) {
            if (!this.$graffitiSession.value || !objects) return [];

            const myActor = this.$graffitiSession.value.actor;
            const channelStates = new Map();

            objects
                .filter(obj => obj.actor === myActor)
                .forEach(obj => {
                    const channel = obj.value.object.channel;
                    const activity = obj.value.activity;

                    if (activity === 'Create' || activity === 'Join') {
                        channelStates.set(channel, true);
                    } else if (activity === 'Leave') {
                        channelStates.set(channel, false);
                    }
                });

            const uniqueGroups = new Map();
            objects.forEach(obj => {
                const channel = obj.value.object.channel;
                if (
                    obj.actor === myActor &&
                    channelStates.get(channel) === true &&
                    ['Create', 'Join'].includes(obj.value.activity)
                ) {
                    if (!uniqueGroups.has(channel)) {
                        uniqueGroups.set(channel, obj);
                    }
                }
            });

            return Array.from(uniqueGroups.values());
        },

        uniqueAvailableGroups(objects) {
            if (!this.$graffitiSession.value || !objects) return [];

            const myActor = this.$graffitiSession.value.actor;
            const channelStates = new Map();

            // Track membership state based on actor's activity
            objects
                .filter(obj => obj.actor === myActor)
                .forEach(obj => {
                    const channel = obj.value.object.channel;
                    const activity = obj.value.activity;

                    if (activity === 'Create' || activity === 'Join') {
                        channelStates.set(channel, true);
                    } else if (activity === 'Leave') {
                        channelStates.set(channel, false);
                    }
                });

            const myJoinedChannels = new Set(
                Array.from(channelStates.entries())
                    .filter(([_, joined]) => joined)
                    .map(([channel]) => channel)
            );

            // Now filter out any group already joined
            const uniqueMap = new Map();
            for (const obj of objects) {
                const channel = obj.value.object.channel;
                if (!myJoinedChannels.has(channel) && !uniqueMap.has(channel)) {
                    uniqueMap.set(channel, obj);
                }
            }

            return Array.from(uniqueMap.values());
        },

        async leaveGroup(groupObj) {
            if (!confirm(`Are you sure you want to leave "${groupObj.value.object.name}"?`)) return;

            try {
                this.myGroups = this.myGroups.filter(
                    channel => channel !== groupObj.value.object.channel
                );

                await this.$graffiti.put({
                    value: {
                        activity: 'Leave',
                        object: {
                            type: 'Group Chat',
                            name: groupObj.value.object.name,
                            channel: groupObj.value.object.channel,
                            image: groupObj.value.object.image || null
                        }
                    },
                    channels: ['designftw']
                }, this.$graffitiSession.value);

                this.forceRefresh++;

            } catch (error) {
                console.error("Failed to leave group:", error);
                alert("Failed to leave group. Please try again.");
            }
        },
        async loadProfile(actorUri) {
            try {
                console.log("Loading profile for:", actorUri);

                const discovery = await this.$graffiti.discover({
                    schema: {
                        properties: {
                            value: {
                                required: ['describes', 'published'],
                                properties: {
                                    describes: { type: 'string' },
                                    published: { type: 'number' },
                                    name: { type: 'string' },
                                    pronouns: { type: 'string' },
                                    bio: { type: 'string' }
                                }
                            }
                        }
                    },
                    channels: [actorUri]
                });

                console.log("Discovery response:", discovery);

                const results = discovery.objects || [];
                console.log("Profile objects found:", results);

                const latest = results
                    .filter(obj => obj.value.describes === actorUri)
                    .sort((a, b) => b.value.published - a.value.published)[0];

                this.profile = latest?.value || null;
                if (this.profile) {
                    this.editName = this.profile.name || "";
                    this.editPronouns = this.profile.pronouns || "";
                    this.editBio = this.profile.bio || "";
                }

            } catch (e) {
                console.error("Failed to load profile:", e);
            }
        },
        scrollToMessage(messageUrl) {
            const messageEl = document.querySelector(`[data-message-url="${messageUrl}"]`);
            if (messageEl) {
                messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                messageEl.classList.add('highlight-message');
                setTimeout(() => {
                    messageEl.classList.remove('highlight-message');
                }, 2000);
            }
        },
        scrollToMessage(messageUrl) {
            const element = document.querySelector(`[data-message-url="${messageUrl}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight-message');
                setTimeout(() => element.classList.remove('highlight-message'), 2000);
            }
        },

        async saveProfile(session) {
            try {
                const newProfile = {
                    describes: session.actor,
                    name: this.editName,
                    pronouns: this.editPronouns,
                    bio: this.editBio,
                    published: Date.now()
                };

                await this.$graffiti.put({
                    value: newProfile,
                    channels: [session.actor]
                }, session);

                this.profile = newProfile;
                this.showProfileModal = false;

                this.forceRefresh++;
            } catch (e) {
                console.error("Failed to save profile:", e);
                alert("Error saving profile.");
            }
        },

        getUserName(actorUri) {
            if (actorUri === this.$graffitiSession.value?.actor) {
                return this.profile?.name || actorUri.split('/').pop() || 'Anonymous';
            }
            return actorUri.split('/').pop() || 'Anonymous';
        },

        getUserPronouns(actorUri) {
            return this.profile?.pronouns || '';
        }


    },

    watch: {
        // messageObjects() {
        //     this.$nextTick(this.scrollToBottom);
        //   },
        messageObjects(newVal, oldVal) {
            this.calculateUnreadCounts(newVal);
            if (!oldVal || newVal.length > oldVal.length) {
                this.$nextTick(this.scrollToBottom);
            }
        },
        currentGroup: {
            async handler(newGroup) {
                if (newGroup) {
                    await this.loadPinnedMessages();
                }
            },
            immediate: true
        },

        profile: {
            handler(newProfile) {
                if (newProfile) {
                    this.forceRefresh++;
                }
            },
            deep: true
        },
    },
    // mounted() {
    //     this.$nextTick(() => {
    //         this.scrollToBottom();
    //     });
    //     // this.$watch(
    //     //     () => this.$graffitiSession.value,
    //     //     async (session) => {
    //     //         if (!session) {
    //     //             this.myGroups = [];
    //     //             return;
    //     //         }

    //     //         try {
    //     //             const discovery = await this.$graffiti.discover({
    //     //                 schema: this.groupDiscoverSchema,
    //     //                 channels: ['designftw']
    //     //             });

    //     //             const results = discovery.objects || [];
    //     //             this.myGroups = results
    //     //                 .filter(obj => obj.actor === session.actor)
    //     //                 .map(obj => obj.value.object.channel);
    //     //         } catch (e) {
    //     //             console.error("Failed to auto-discover groups:", e);
    //     //         }

    //     //         await this.loadProfile(session.actor);
    //     //     },
    //     //     { immediate: true }
    //     // );
    //     console.log('Graffiti instance:', this.$graffiti);
    //     console.log('Graffiti session:', this.$graffitiSession.value);

    //     this.$watch(
    //         () => this.$graffitiSession.value,
    //         async (session) => {
    //             console.log('Session changed:', session);
    //             if (session) {
    //                 await this.loadPinnedMessages(session);
    //             }
    //         },
    //         { immediate: true }
    //     );

    // }
    mounted() {
        this.$nextTick(() => {
            this.scrollToBottom();
        });

        this.$watch(
            () => this.$graffitiSession.value,
            async (session) => {
                if (!session) {
                    this.myGroups = [];
                    return;
                }

                try {
                    const discovery = await this.$graffiti.discover({
                        schema: this.groupDiscoverSchema,
                        channels: ['designftw']
                    });

                    const results = discovery.objects || [];
                    const channelStates = new Map();

                    results
                        .filter(obj => obj.actor === session.actor)
                        .forEach(obj => {
                            const channel = obj.value.object.channel;
                            const activity = obj.value.activity;
                            if (activity === 'Create' || activity === 'Join') {
                                channelStates.set(channel, true);
                            } else if (activity === 'Leave') {
                                channelStates.set(channel, false);
                            }
                        });

                    this.myGroups = Array.from(channelStates.entries())
                        .filter(([_, joined]) => joined)
                        .map(([channel]) => channel);
                } catch (e) {
                    console.error("Failed to auto-discover groups:", e);
                }

                await this.loadProfile(session.actor);
            },
            { immediate: true }
        );
        this.myGroups.forEach(channel => {
            this.lastViewedTimes[channel] = Date.now();
            this.unreadCounts[channel] = 0;
        });
    }

})

    .directive('focus', focusDirective)
    .component('group-card', GroupCard)
    .use(GraffitiPlugin, {
        graffiti: new GraffitiLocal(),
        // graffiti: new GraffitiRemote(),
    })
    .mount("#app");