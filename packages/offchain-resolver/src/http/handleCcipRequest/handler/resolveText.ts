import { IDatabase } from '../../../persistance/IDatabase';
import { PROFILE_RECORD_NAME } from 'dm3-lib-profile/dist.backend';
import { stringify } from 'dm3-lib-shared/dist.backend';
import { interceptTextRecord } from './intercept';
import { logDebug } from 'dm3-lib-shared';

export async function handleText(db: IDatabase, request: any) {
    const { record, name } = request;

    const interceptResult = interceptTextRecord(name, record);
    logDebug({ text: '[Interceptor handleText] result ', interceptResult });

    if (interceptResult) {
        return interceptResult;
    }
    if (record !== PROFILE_RECORD_NAME) {
        throw Error(`${record} Record is not supported by this resolver`);
    }

    const userProfile = await db.getUserProfile(name);

    return userProfile
        ? 'data:application/json,' + stringify(userProfile)
        : null;
}