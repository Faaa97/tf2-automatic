import { EconItem } from 'steam-tradeoffer-manager';
import { Item as TF2Item } from '../../../types/TeamFortress2';

import SKU from 'tf2-sku';
import url from 'url';

import schemaManager from '../../../lib/tf2-schema';

import fixItem from './fixItem';

export = function () {
    // @ts-ignore
    const self = <EconItem>this;

    if (self.appid != 440) {
        return null;
    }

    const item = Object.assign({
        defindex: getDefindex(self),
        quality: getQuality(self),
        craftable: isCraftable(self),
        killstreak: getKillstreak(self),
        australium: isAustralium(self),
        festive: isFestive(self),
        effect: getEffect(self),
        wear: getWear(self),
        paintkit: getPaintKit(self),
        quality2: getElevatedQuality(self)
    }, getOutput(self));

    if (item.target === null) {
        item.target = getTarget(self);
    }

    // Adds missing properties
    return fixItem(SKU.fromString(SKU.fromObject(item)));
};

/**
 * Gets the defindex of an item
 * @param item
 */
function getDefindex (item: EconItem): number {
    if (item.app_data !== undefined) {
        return parseInt(item.app_data.def_index, 10);
    }

    const link = item.getAction('Item Wiki Page...');

    if (link !== null) {
        return parseInt(url.parse(link, true).query.id.toString(), 10);
    }

    // Last option is to get the name of the item and try and get the defindex that way

    return null;
}

/**
 * Gets the quality of an item
 * @param item
 */
function getQuality (item: EconItem): number {
    if (item.app_data !== undefined) {
        return parseInt(item.app_data.quality, 10);
    }

    const quality = item.getTag('Quality');
    if (quality !== null) {
        return schemaManager.schema.getQualityIdByName(quality);
    }

    return null;
}

/**
 * Determines if the item is craftable
 * @param item
 */
function isCraftable (item: EconItem): boolean {
    return !item.hasDescription('( Not Usable in Crafting )');
}

/**
 * Gets the killstreak tier of an item
 * @param item
 */
function getKillstreak (item: EconItem): number {
    const killstreaks = ['Professional ', 'Specialized ', ''];

    const index = killstreaks.findIndex((killstreak) => item.market_hash_name.indexOf(killstreak + 'Killstreak') !== -1);

    return index === -1 ? 0 : 3 - index;
}

/**
 * Determines if the item is australium
 * @param item
 */
function isAustralium (item: EconItem): boolean {
    if (item.getTag('Quality') !== 'Strange') {
        return false;
    }

    return item.market_hash_name.indexOf('Australium ') !== -1;
}

/**
 * Determines if thje item is festivized
 * @param item
 */
function isFestive (item: EconItem): boolean {
    return item.market_hash_name.indexOf('Festivized ') !== -1;
}

/**
 * Gets the effect of an item
 * @param item
 */
function getEffect (item: EconItem): number {
    if (!Array.isArray(item.descriptions)) {
        return null;
    }

    if (item.descriptions.some((description) => description.value === 'Case Global Unusual Effect(s)')) {
        return null;
    }

    const effects = item.descriptions.filter((description) => description.value.startsWith('★ Unusual Effect: '));

    if (effects.length !== 1) {
        return null;
    }

    return schemaManager.schema.getEffectIdByName(effects[0].value.substring(18));
}

/**
 * Gets the wear of an item
 * @param item
 */
function getWear (item: EconItem): number {
    const wear = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle Scarred'].indexOf(item.getTag('Exterior'));

    return wear === -1 ? null : wear + 1;
}

/**
 * Get skin from item
 * @param item
 */
function getPaintKit (item: EconItem): number {
    if (getWear(item) === null) {
        return null;
    }

    let hasCaseCollection = false;
    let skin = null;

    for (let i = 0; i < item.descriptions.length; i++) {
        const description = item.descriptions[i].value;

        if (!hasCaseCollection && description.endsWith('Collection')) {
            hasCaseCollection = true;
        } else if (hasCaseCollection && (description.startsWith('✔') || description.startsWith('★'))) {
            skin = description.substring(1).replace(' War Paint', '').trim();
            break;
        }
    }

    if (skin === null) {
        return null;
    }

    if (skin.indexOf('Mk.I') !== -1) {
        return schemaManager.schema.getSkinIdByName(skin);
    }

    const schemaItem = schemaManager.schema.getItemByDefindex(getDefindex(item));

    // Remove weapon from skin name
    skin = skin.replace(schemaItem.item_type_name, '').trim();

    return schemaManager.schema.getSkinIdByName(skin);
}

/**
 * Gets the elevated quality of an item
 * @param item
 */
function getElevatedQuality (item: EconItem): number {
    if (item.hasDescription('Strange Stat Clock Attached')) {
        return 11;
    } else {
        return null;
    }
}

function getOutput (item: EconItem): { target: number, output: number, outputQuality: number } {
    let index = -1;

    for (let i = 0; i < item.descriptions.length; i++) {
        const description = item.descriptions[i].value;

        if (description == 'You will receive all of the following outputs once all of the inputs are fulfilled.') {
            index = i;
            break;
        }
    }

    if (index === -1) {
        return {
            target: null,
            output: null,
            outputQuality: null
        };
    }

    const output = item.descriptions[index + 1].value;

    let target = null;
    let outputQuality = null;
    let outputDefindex = null;

    const killstreak = getKillstreak(item);

    if (killstreak !== 0) {
        // Killstreak Kit Fabricator

        const name = output.replace(['Killstreak', 'Specialized Killstreak', 'Professional Killstreak'][killstreak - 1], '').replace('Kit', '').trim();

        target = schemaManager.schema.getItemByItemName(name).defindex;
        outputQuality = 6;
        outputDefindex = [6527, 6523, 6526][killstreak - 1];
    } else if (output.indexOf(' Strangifier') !== -1) {
        // Strangifier Chemistry Set

        const name = output.replace('Strangifier', '').trim();

        target = schemaManager.schema.getItemByItemName(name).defindex;
        outputQuality = 6;
        outputDefindex = 6522;
    } else if (output.indexOf(' Collector\'s') !== -1) {
        // Collector's Chemistry Set

        const name = output.replace('Collector\'s', '').trim();

        outputQuality = 14;
        outputDefindex = schemaManager.schema.getItemByItemName(name).defindex;
    }

    return {
        target: target,
        output: outputDefindex,
        outputQuality: outputQuality
    };
}

function getTarget (item: EconItem): number {
    const defindex = getDefindex(item);

    if (defindex === null) {
        throw new Error('Could not get defindex of item "' + item.market_hash_name + '"');
    }

    if (item.market_hash_name.indexOf('Strangifier') !== -1) {
        // Strangifiers
        const gameItem = schemaManager.schema.raw.items_game.items[defindex];

        if (gameItem.attributes !== undefined && gameItem.attributes['tool target item'] !== undefined) {
            return parseInt(gameItem.attributes['tool target item'].value, 10);
        } else if (gameItem.static_attrs !== undefined && gameItem.static_attrs['tool target item'] !== undefined) {
            return parseInt(gameItem.static_attrs['tool target item'], 10);
        }

        // Get schema item using market_hash_name
        const schemaItem = schemaManager.schema.getItemByItemName(item.market_hash_name.replace('Strangifier', '').trim());

        if (schemaItem !== null) {
            return schemaItem.defindex;
        }

        throw new Error('Could not find target for item "' + item.market_hash_name + '"');
    }

    if (defindex === 6527) {
        // Killstreak Kit
        return schemaManager.schema.getItemByItemName(item.market_hash_name.substring(10, item.market_hash_name.length - 3).replace('Killstreak', '').trim()).defindex;
    } else if (defindex === 6523) {
        // Specialized Killstreak Kit
        return schemaManager.schema.getItemByItemName(item.market_hash_name.substring(22, item.market_hash_name.length - 3).trim()).defindex;
    } else if (defindex === 6526) {
        // Professional Killstreak Kit
        return schemaManager.schema.getItemByItemName(item.market_hash_name.substring(23, item.market_hash_name.length - 3).trim()).defindex;
    }

    return null;
}