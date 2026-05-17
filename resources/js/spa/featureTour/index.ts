import type { DriveStep } from 'driver.js';

export interface TourSegment {
    name: string;
    routeName: string;
    // Geef params terug voor parameterised routes. Returnt `null` als de
    // benodigde data nog niet beschikbaar is — de mount-component skipt het
    // segment dan en gaat naar het volgende.
    resolveParams?: () => Record<string, string> | null;
    steps: DriveStep[];
}

import { circleDetailSegment } from './segments/circleDetail';
import { circlesSegment } from './segments/circles';
import { defaultCirclesSegment } from './segments/defaultCircles';
import { feedSegment } from './segments/feed';
import { giveSegment } from './segments/give';
import { mapSegment } from './segments/map';
import { personsSegment } from './segments/persons';
import { profileSegment } from './segments/profile';

// Een nieuwe lijst per call zodat translation-keys opnieuw geëvalueerd worden
// als de gebruiker tussendoor van taal wisselt.
export function getSegments(): TourSegment[] {
    return [
        feedSegment(),
        circlesSegment(),
        circleDetailSegment(),
        personsSegment(),
        defaultCirclesSegment(),
        giveSegment(),
        mapSegment(),
        profileSegment(),
    ];
}
