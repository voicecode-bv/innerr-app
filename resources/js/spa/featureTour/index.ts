import type { DriveStep } from 'driver.js';

export interface TourSegment {
    name: string;
    routeName: string;
    // Return params for parameterised routes. Returns `null` when the
    // required data is not available yet — the mount component then skips
    // the segment and moves on to the next one.
    resolveParams?: () => Record<string, string> | null;
    steps: DriveStep[];
}

import { circleDetailSegment } from './segments/circleDetail';
import { circlesSegment } from './segments/circles';
import { defaultCirclesSegment } from './segments/defaultCircles';
import { feedSegment } from './segments/feed';
import { mapSegment } from './segments/map';
import { personsSegment } from './segments/persons';
import { profileSegment } from './segments/profile';

// A fresh list per call so translation keys are re-evaluated when the user
// switches language in between.
export function getSegments(): TourSegment[] {
    return [
        feedSegment(),
        circlesSegment(),
        circleDetailSegment(),
        personsSegment(),
        defaultCirclesSegment(),
        mapSegment(),
        profileSegment(),
    ];
}
