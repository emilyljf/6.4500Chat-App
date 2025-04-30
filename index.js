import { createApp } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiRemote } from "@graffiti-garden/implementation-remote";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";

const focusDirective = {
    mounted(el) {
        el.focus();
    }
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
            }
        };
    },

    methods: {
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

        async enterGroup(group) {
            this.currentGroup = {
                ...group,
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

        handleMessagesDiscovered({ objects: messages }) {
            this.messageObjects = messages.sort((a, b) => b.value.published - a.value.published);
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

            return objects.filter(obj => {
                const channel = obj.value.object.channel;
                return channelStates.get(channel) === true &&
                    obj.actor === myActor &&
                    ['Create', 'Join'].includes(obj.value.activity);
            });
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
        }
    },
    mounted() {
        this.$watch(
            () => this.$graffitiSession.value,
            async (session) => {
                if (!session) {
                    this.myGroups = [];
                    return;
                }

                try {
                    const result = await this.$graffiti.query({
                        schema: this.groupDiscoverSchema,
                        channels: ['designftw']
                    });

                    this.myGroups = result
                        .filter(obj => obj.actor === session.actor)
                        .map(obj => obj.value.object.channel);

                } catch (e) {
                    console.error("Failed to auto-discover groups:", e);
                }
            },
            { immediate: true }
        );
    }
})
    .directive('focus', focusDirective)
    .use(GraffitiPlugin, {
        // graffiti: new GraffitiLocal(),
        graffiti: new GraffitiRemote(),
    })
    .mount("#app");

