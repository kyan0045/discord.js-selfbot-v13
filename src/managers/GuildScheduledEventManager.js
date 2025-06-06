'use strict';

const { Collection } = require('@discordjs/collection');
const CachedManager = require('./CachedManager');
const { TypeError, Error } = require('../errors');
const { GuildScheduledEvent } = require('../structures/GuildScheduledEvent');
const { PrivacyLevels, GuildScheduledEventEntityTypes, GuildScheduledEventStatuses } = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
const Util = require('../util/Util');

/**
 * Manages API methods for GuildScheduledEvents and stores their cache.
 * @extends {CachedManager}
 */
class GuildScheduledEventManager extends CachedManager {
  constructor(guild, iterable) {
    super(guild.client, GuildScheduledEvent, iterable);

    /**
     * The guild this manager belongs to
     * @type {Guild}
     */
    this.guild = guild;
  }

  /**
   * The cache of this manager
   * @type {Collection<Snowflake, GuildScheduledEvent>}
   * @name GuildScheduledEventManager#cache
   */

  /**
   * Data that resolves to give a GuildScheduledEvent object. This can be:
   * * A Snowflake
   * * A GuildScheduledEvent object
   * @typedef {Snowflake|GuildScheduledEvent} GuildScheduledEventResolvable
   */

  /**
   * Options for setting a recurrence rule for a guild scheduled event.
   * @typedef {Object} GuildScheduledEventRecurrenceRuleOptions
   * @property {DateResolvable} startAt The time the recurrence rule interval starts at
   * @property {GuildScheduledEventRecurrenceRuleFrequency} frequency How often the event occurs
   * @property {number} interval The spacing between the events
   * @property {?GuildScheduledEventRecurrenceRuleWeekday[]} byWeekday The days within a week to recur on
   * @property {?GuildScheduledEventRecurrenceRuleNWeekday[]} byNWeekday The days within a week to recur on
   * @property {?GuildScheduledEventRecurrenceRuleMonth[]} byMonth The months to recur on
   * @property {?number[]} byMonthDay The days within a month to recur on
   */

  /**
   * Options used to create a guild scheduled event.
   * @typedef {Object} GuildScheduledEventCreateOptions
   * @property {string} name The name of the guild scheduled event
   * @property {DateResolvable} scheduledStartTime The time to schedule the event at
   * @property {DateResolvable} [scheduledEndTime] The time to end the event at
   * <warn>This is required if `entityType` is 'EXTERNAL'</warn>
   * @property {PrivacyLevel|number} privacyLevel The privacy level of the guild scheduled event
   * @property {GuildScheduledEventEntityType|number} entityType The scheduled entity type of the event
   * @property {string} [description] The description of the guild scheduled event
   * @property {GuildVoiceChannelResolvable} [channel] The channel of the guild scheduled event
   * <warn>This is required if `entityType` is 'STAGE_INSTANCE' or `VOICE`</warn>
   * @property {GuildScheduledEventEntityMetadataOptions} [entityMetadata] The entity metadata of the
   * guild scheduled event
   * <warn>This is required if `entityType` is 'EXTERNAL'</warn>
   * @property {?(BufferResolvable|Base64Resolvable)} [image] The cover image of the guild scheduled event
   * @property {string} [reason] The reason for creating the guild scheduled event
   * @property {GuildScheduledEventRecurrenceRuleOptions} [recurrenceRule]
   * The recurrence rule of the guild scheduled event
   */

  /**
   * Options used to set entity metadata of a guild scheduled event.
   * @typedef {Object} GuildScheduledEventEntityMetadataOptions
   * @property {string} [location] The location of the guild scheduled event
   * <warn>This is required if `entityType` is 'EXTERNAL'</warn>
   */

  /**
   * Creates a new guild scheduled event.
   * @param {GuildScheduledEventCreateOptions} options Options for creating the guild scheduled event
   * @returns {Promise<GuildScheduledEvent>}
   */
  async create(options) {
    if (typeof options !== 'object') throw new TypeError('INVALID_TYPE', 'options', 'object', true);
    let {
      privacyLevel,
      entityType,
      channel,
      name,
      scheduledStartTime,
      description,
      scheduledEndTime,
      entityMetadata,
      reason,
      image,
      recurrenceRule,
    } = options;

    if (typeof privacyLevel === 'string') privacyLevel = PrivacyLevels[privacyLevel];
    if (typeof entityType === 'string') entityType = GuildScheduledEventEntityTypes[entityType];

    let entity_metadata, channel_id;
    if (entityType === GuildScheduledEventEntityTypes.EXTERNAL) {
      channel_id = typeof channel === 'undefined' ? channel : null;
      entity_metadata = { location: entityMetadata?.location };
    } else {
      channel_id = this.guild.channels.resolveId(channel);
      if (!channel_id) throw new Error('GUILD_VOICE_CHANNEL_RESOLVE');
      entity_metadata = typeof entityMetadata === 'undefined' ? entityMetadata : null;
    }

    const data = await this.client.api.guilds(this.guild.id, 'scheduled-events').post({
      data: {
        channel_id,
        name,
        privacy_level: privacyLevel,
        scheduled_start_time: new Date(scheduledStartTime).toISOString(),
        scheduled_end_time: scheduledEndTime ? new Date(scheduledEndTime).toISOString() : scheduledEndTime,
        description,
        image: image && (await DataResolver.resolveImage(image)),
        entity_type: entityType,
        entity_metadata,
        recurrence_rule: recurrenceRule && Util.transformGuildScheduledEventRecurrenceRule(recurrenceRule),
      },
      reason,
    });

    return this._add(data);
  }

  /**
   * Options used to fetch a single guild scheduled event from a guild.
   * @typedef {BaseFetchOptions} FetchGuildScheduledEventOptions
   * @property {GuildScheduledEventResolvable} guildScheduledEvent The guild scheduled event to fetch
   * @property {boolean} [withUserCount=true] Whether to fetch the number of users subscribed to the scheduled event
   */

  /**
   * Options used to fetch multiple guild scheduled events from a guild.
   * @typedef {Object} FetchGuildScheduledEventsOptions
   * @property {boolean} [cache] Whether or not to cache the fetched guild scheduled events
   * @property {boolean} [withUserCount=true] Whether to fetch the number of users subscribed to each scheduled event
   * should be returned
   */

  /**
   * Obtains one or more guild scheduled events from Discord, or the guild cache if it's already available.
   * @param {GuildScheduledEventResolvable|FetchGuildScheduledEventOptions|FetchGuildScheduledEventsOptions} [options]
   * The id of the guild scheduled event or options
   * @returns {Promise<GuildScheduledEvent|Collection<Snowflake, GuildScheduledEvent>>}
   */
  async fetch(options = {}) {
    const id = this.resolveId(options.guildScheduledEvent ?? options);

    if (id) {
      if (!options.force) {
        const existing = this.cache.get(id);
        if (existing) return existing;
      }

      const data = await this.client.api
        .guilds(this.guild.id, 'scheduled-events', id)
        .get({ query: { with_user_count: options.withUserCount ?? true } });
      return this._add(data, options.cache);
    }

    const data = await this.client.api
      .guilds(this.guild.id, 'scheduled-events')
      .get({ query: { with_user_count: options.withUserCount ?? true } });

    return data.reduce(
      (coll, rawGuildScheduledEventData) =>
        coll.set(rawGuildScheduledEventData.id, this._add(rawGuildScheduledEventData, options.cache)),
      new Collection(),
    );
  }

  /**
   * Options used to edit a guild scheduled event.
   * @typedef {Object} GuildScheduledEventEditOptions
   * @property {string} [name] The name of the guild scheduled event
   * @property {DateResolvable} [scheduledStartTime] The time to schedule the event at
   * @property {DateResolvable} [scheduledEndTime] The time to end the event at
   * @property {PrivacyLevel|number} [privacyLevel] The privacy level of the guild scheduled event
   * @property {GuildScheduledEventEntityType|number} [entityType] The scheduled entity type of the event
   * @property {string} [description] The description of the guild scheduled event
   * @property {?GuildVoiceChannelResolvable} [channel] The channel of the guild scheduled event
   * @property {GuildScheduledEventStatus|number} [status] The status of the guild scheduled event
   * @property {GuildScheduledEventEntityMetadataOptions} [entityMetadata] The entity metadata of the
   * guild scheduled event
   * <warn>This can be modified only if `entityType` of the `GuildScheduledEvent` to be edited is 'EXTERNAL'</warn>
   * @property {?(BufferResolvable|Base64Resolvable)} [image] The cover image of the guild scheduled event
   * @property {string} [reason] The reason for editing the guild scheduled event
   * @property {?GuildScheduledEventRecurrenceRuleOptions} [recurrenceRule]
   * The recurrence rule of the guild scheduled event
   */

  /**
   * Edits a guild scheduled event.
   * @param {GuildScheduledEventResolvable} guildScheduledEvent The guild scheduled event to edit
   * @param {GuildScheduledEventEditOptions} options Options to edit the guild scheduled event
   * @returns {Promise<GuildScheduledEvent>}
   */
  async edit(guildScheduledEvent, options) {
    const guildScheduledEventId = this.resolveId(guildScheduledEvent);
    if (!guildScheduledEventId) throw new Error('GUILD_SCHEDULED_EVENT_RESOLVE');

    if (typeof options !== 'object') throw new TypeError('INVALID_TYPE', 'options', 'object', true);
    let {
      privacyLevel,
      entityType,
      channel,
      status,
      name,
      scheduledStartTime,
      description,
      scheduledEndTime,
      entityMetadata,
      reason,
      image,
      recurrenceRule,
    } = options;

    if (typeof privacyLevel === 'string') privacyLevel = PrivacyLevels[privacyLevel];
    if (typeof entityType === 'string') entityType = GuildScheduledEventEntityTypes[entityType];
    if (typeof status === 'string') status = GuildScheduledEventStatuses[status];

    let entity_metadata;
    if (entityMetadata) {
      entity_metadata = {
        location: entityMetadata.location,
      };
    }

    const data = await this.client.api.guilds(this.guild.id, 'scheduled-events', guildScheduledEventId).patch({
      data: {
        channel_id: typeof channel === 'undefined' ? channel : this.guild.channels.resolveId(channel),
        name,
        privacy_level: privacyLevel,
        scheduled_start_time: scheduledStartTime ? new Date(scheduledStartTime).toISOString() : undefined,
        scheduled_end_time: scheduledEndTime ? new Date(scheduledEndTime).toISOString() : scheduledEndTime,
        description,
        entity_type: entityType,
        status,
        image: image && (await DataResolver.resolveImage(image)),
        entity_metadata,
        recurrence_rule: recurrenceRule && Util.transformGuildScheduledEventRecurrenceRule(recurrenceRule),
      },
      reason,
    });

    return this._add(data);
  }

  /**
   * Deletes a guild scheduled event.
   * @param {GuildScheduledEventResolvable} guildScheduledEvent The guild scheduled event to delete
   * @returns {Promise<void>}
   */
  async delete(guildScheduledEvent) {
    const guildScheduledEventId = this.resolveId(guildScheduledEvent);
    if (!guildScheduledEventId) throw new Error('GUILD_SCHEDULED_EVENT_RESOLVE');

    await this.client.api.guilds(this.guild.id, 'scheduled-events', guildScheduledEventId).delete();
  }

  /**
   * Options used to fetch subscribers of a guild scheduled event
   * @typedef {Object} FetchGuildScheduledEventSubscribersOptions
   * @property {number} [limit] The maximum numbers of users to fetch
   * @property {boolean} [withMember] Whether to fetch guild member data of the users
   * @property {Snowflake} [before] Consider only users before this user id
   * @property {Snowflake} [after] Consider only users after this user id
   * <warn>If both `before` and `after` are provided, only `before` is respected</warn>
   */

  /**
   * Represents a subscriber of a {@link GuildScheduledEvent}
   * @typedef {Object} GuildScheduledEventUser
   * @property {Snowflake} guildScheduledEventId The id of the guild scheduled event which the user subscribed to
   * @property {User} user The user that subscribed to the guild scheduled event
   * @property {?GuildMember} member The guild member associated with the user, if any
   */

  /**
   * Fetches subscribers of a guild scheduled event.
   * @param {GuildScheduledEventResolvable} guildScheduledEvent The guild scheduled event to fetch subscribers of
   * @param {FetchGuildScheduledEventSubscribersOptions} [options={}] Options for fetching the subscribers
   * @returns {Promise<Collection<Snowflake, GuildScheduledEventUser>>}
   */
  async fetchSubscribers(guildScheduledEvent, options = {}) {
    const guildScheduledEventId = this.resolveId(guildScheduledEvent);
    if (!guildScheduledEventId) throw new Error('GUILD_SCHEDULED_EVENT_RESOLVE');

    let { limit, withMember, before, after } = options;

    const data = await this.client.api.guilds(this.guild.id, 'scheduled-events', guildScheduledEventId).users.get({
      query: { limit, with_member: withMember, before, after },
    });

    return data.reduce(
      (coll, rawData) =>
        coll.set(rawData.user.id, {
          guildScheduledEventId: rawData.guild_scheduled_event_id,
          user: this.client.users._add(rawData.user),
          member: rawData.member ? this.guild.members._add({ ...rawData.member, user: rawData.user }) : null,
        }),
      new Collection(),
    );
  }
}

module.exports = GuildScheduledEventManager;
