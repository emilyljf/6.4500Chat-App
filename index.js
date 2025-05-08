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
//     props: ['group', 'isMember', 'onOpen', 'onJoin', 'onLeave', 'onDelete', 'isCreator'],
//     template: `
//         <div class="group-card">
//             <div class="group-image" @click="onOpen(group.value.object)">
//                 <img v-if="group.value.object.image" :src="group.value.object.image" alt="Group image" />
//                 <div v-else class="default-group-image">
//                     {{ group.value.object.name?.charAt(0).toUpperCase() || 'G' }}
//                 </div>
//             </div>
//             <div class="group-info">
//                 <h4>{{ group.value.object.name }}</h4>
//                 <button v-if="isMember" @click="onOpen(group.value.object)" class="open-btn">Open</button>
//                 <button v-if="isMember" @click="onLeave(group)" class="leave-btn">Leave</button>
//                 <button v-if="!isMember" @click="onJoin(group)" class="join-btn">Join</button>
//                 <button v-if="isCreator" @click="onDelete(group)" class="delete-btn">Delete</button>
//             </div>
//         </div>
//     `
// };
const GroupCard = {
    props: ['group', 'isMember', 'onOpen', 'onJoin', 'onLeave', 'isCreator'],
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
        };
    },

    computed: {
        isMessagePinned() {
            return (messageUrl) => this.pinnedMessageUrls.has(messageUrl);
        }
    },

    methods: {
        // async pinMessage(message, session) {
        //     const messageUrl = message.url;
        //     const actor = session.actor;
        
        //     // Check if this user has already pinned it
        //     const existingPin = this.pinnedMessages.find(
        //         pin => pin.value.describes === messageUrl && pin.actor === actor
        //     );
        
        //     try {
        //         if (existingPin) {
        //             // If already pinned, unpin it
        //             await this.$graffiti.delete(existingPin, session);
        //             this.pinnedMessages = this.pinnedMessages.filter(p => p !== existingPin);
        //             this.pinnedMessageUrls.delete(messageUrl);
        //         } else {
        //             // Otherwise, pin it
        //             const pinActivity = {
        //                 value: {
        //                     activity: 'Pin',
        //                     describes: messageUrl,
        //                     published: Date.now()
        //                 },
        //                 channels: [this.currentGroup.channel]
        //             };
        
        //             const result = await this.$graffiti.put(pinActivity, session);
        //             this.pinnedMessages.unshift({
        //                 url: result.url,
        //                 actor: actor,
        //                 value: pinActivity.value
        //             });
        //             this.pinnedMessageUrls.add(messageUrl);
        //         }
        
        //         this.$forceUpdate(); // refresh pinned dropdown and UI
        //     } catch (error) {
        //         console.error("Failed to pin/unpin message:", error);
        //         alert("Could not update pin.");
        //     }
        // },
        async pinMessage(message, session) {
            const messageUrl = message.url;
            const actor = session.actor;
        
            const existingPin = this.pinnedMessages.find(
                pin => pin.value.describes === messageUrl && pin.actor === actor
            );
        
            try {
                if (existingPin) {
                    await this.$graffiti.delete(existingPin, session);
                    this.pinnedMessages = this.pinnedMessages.filter(p => p !== existingPin);
                    this.pinnedMessageUrls.delete(messageUrl);
                    this.myPinnedMessageUrls.delete(messageUrl);
                } else {
                    const pinActivity = {
                        value: {
                            activity: 'Pin',
                            describes: messageUrl,
                            published: Date.now()
                        },
                        channels: [this.currentGroup.channel]
                    };
        
                    const result = await this.$graffiti.put(pinActivity, session);
        
                    this.pinnedMessages.unshift({
                        url: result.url,
                        actor: actor,
                        value: pinActivity.value
                    });
        
                    this.pinnedMessageUrls.add(messageUrl);
                    this.myPinnedMessageUrls.add(messageUrl);
                }
        
                this.$forceUpdate();
            } catch (error) {
                console.error("Failed to pin/unpin message:", error);
                alert("Could not update pin.");
            }
        },        
        
        async unpinMessage(pin) {
            try {
                await this.$graffiti.delete(pin, this.$graffitiSession.value);
                this.forceRefresh++; // Trigger discovery refresh
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

                // Pre-fetch content for all pinned messages
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
            console.log('Toggle clicked - current state:', this.showPinnedDropdown);
            console.log('Current group exists:', !!this.currentGroup);
            this.showPinnedDropdown = !this.showPinnedDropdown;
            console.log('New state:', this.showPinnedDropdown);
            if (this.showPinnedDropdown && this.currentGroup) {
                console.log('Loading pinned messages...');
                this.loadPinnedMessages();
            }
        },

        togglePinnedVisibility() {
            this.showPinned = !this.showPinned;
        },

        findMessageContent(messageUrl) {
            // First check the current messages
            const message = this.messageObjects.find(m => m.url === messageUrl);
            if (message) return message.value.content;

            // Then check the message cache
            if (this.messageCache.has(messageUrl)) {
                return this.messageCache.get(messageUrl);
            }

            // If not found, fetch it immediately and return a loading message
            this.fetchMessage(messageUrl);
            return "Loading...";
        },

        async fetchMessage(messageUrl) {
            try {
                const response = await this.$graffiti.get(messageUrl, { schema: this.messageSchema });
                if (response?.value?.content) {
                    this.messageCache.set(messageUrl, response.value.content);
                    // Force update to refresh the pinned messages display
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
            } catch (error) {
                console.error("Failed to send message:", error);
            } finally {
                this.sending = false;
                await this.$nextTick();
                this.$refs.messageInput?.focus();
            }
        },

        async createGroupChat(session) {
            if (!this.newGroupName) return;

            this.creatingGroup = true;

            try {
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
                    channels: ["designftw"]
                };

                await this.$graffiti.put(newGroup, session);

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
        //         ...group,
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
        // },
        async enterGroup(group) {
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

        handleMessagesDiscovered({ objects }) {
            console.log("📨 Discovered messages:", objects.map(m => m.url));
            this.messageObjects = objects.sort((a, b) => b.value.published - a.value.published);
            objects.forEach(msg => {
                this.messageCache.set(msg.url, msg.value.content);
            });
            this.$forceUpdate();
        },


        // handlePinsDiscovered({ objects }) {
        //     console.log("📌 Discovered pins:", objects.map(p => p.value.describes)); // <-- Add this

        //     this.pinnedMessages = objects.sort((a, b) => b.value.published - a.value.published);
        //     this.pinnedMessageUrls = new Set(objects.map(pin => pin.value.describes));
        // },
        handlePinsDiscovered({ objects }) {
            const me = this.$graffitiSession?.value?.actor;
        
            this.pinnedMessages = objects.sort((a, b) => b.value.published - a.value.published);
        
            // All pinned messages
            this.pinnedMessageUrls = new Set(objects.map(pin => pin.value.describes));
        
            // Only messages YOU pinned
            this.myPinnedMessageUrls = new Set(
                objects.filter(pin => pin.actor === me).map(pin => pin.value.describes)
            );
        
            // Pre-fetch content
            this.pinnedMessages.forEach(pin => {
                if (!this.messageCache.has(pin.value.describes)) {
                    this.fetchMessage(pin.value.describes);
                }
            });
        
            this.$forceUpdate();
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

        onGroupsDiscovered(objects) {
            console.log("Discovered groups:", objects);
            this.groupObjects = objects;
        },

        // filteredMyGroups(objects) {
        //     if (!this.$graffitiSession.value || !objects) return [];

        //     const myActor = this.$graffitiSession.value.actor;
        //     const channelStates = new Map();

        //     objects
        //         .filter(obj => obj.actor === myActor)
        //         .forEach(obj => {
        //             const channel = obj.value.object.channel;
        //             const activity = obj.value.activity;

        //             if (activity === 'Create' || activity === 'Join') {
        //                 channelStates.set(channel, true);
        //             } else if (activity === 'Leave') {
        //                 channelStates.set(channel, false);
        //             }
        //         });

        //     return objects.filter(obj => {
        //         const channel = obj.value.object.channel;
        //         return channelStates.get(channel) === true &&
        //             obj.actor === myActor &&
        //             ['Create', 'Join'].includes(obj.value.activity);
        //     });
        // },
        filteredMyGroups(objects) {
            if (!this.$graffitiSession.value || !objects) return [];
        
            const myActor = this.$graffitiSession.value.actor;
            const channelStates = new Map();
        
            // Track latest join/leave state
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
        
            // Deduplicate by channel using a Map
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
        }
    },
    mounted() {
        // this.$watch(
        //     () => this.$graffitiSession.value,
        //     async (session) => {
        //         if (!session) {
        //             this.myGroups = [];
        //             return;
        //         }

        //         try {
        //             const discovery = await this.$graffiti.discover({
        //                 schema: this.groupDiscoverSchema,
        //                 channels: ['designftw']
        //             });

        //             const results = discovery.objects || [];
        //             this.myGroups = results
        //                 .filter(obj => obj.actor === session.actor)
        //                 .map(obj => obj.value.object.channel);
        //         } catch (e) {
        //             console.error("Failed to auto-discover groups:", e);
        //         }

        //         await this.loadProfile(session.actor);
        //     },
        //     { immediate: true }
        // );
        console.log('Graffiti instance:', this.$graffiti); // Verify Graffiti is available
        console.log('Graffiti session:', this.$graffitiSession.value); // Verify session

        this.$watch(
            () => this.$graffitiSession.value,
            async (session) => {
                console.log('Session changed:', session); // Debug log
                if (session) {
                    await this.loadPinnedMessages(session);
                }
            },
            { immediate: true }
        );

    }
})

    .directive('focus', focusDirective)
    .component('group-card', GroupCard)
    .use(GraffitiPlugin, {
        graffiti: new GraffitiLocal(),
        // graffiti: new GraffitiRemote(),
    })
    .mount("#app");
