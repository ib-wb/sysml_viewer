// Beispielprojekt Indoorroboter – Anforderungen
private import ScalarValues::*;

package Anforderungen {
    private import RequirementDerivation::*;

    requirement def <'A1'> Laufzeit {
        doc /* Der Roboter fährt mit einer Akkuladung mindestens 2 Stunden. */
        subject r : Struktur::Roboter;
        attribute laufzeit : Real;
        require constraint { laufzeit >= 2 }
    }
    requirement def <'A2'> Hinderniserkennung {
        doc /* Hindernisse ab 30 cm Entfernung werden in jeder Fahrtrichtung erkannt. */
    }
    requirement def <'A2.1'> Scanrate {
        doc /* Der Lidar liefert mindestens 10 vollständige Scans pro Sekunde. */
    }
    requirement def <'A3'> Gewicht {
        doc /* Die Gesamtmasse des Roboters liegt unter 4 kg. */
        attribute mGesamt : Real;
        require constraint { mGesamt < 4 }
    }
    requirement def <'A4'> Notaus {
        doc /* Ein Not-Aus-Taster stoppt beide Antriebsmotoren in weniger als 100 ms. */
    }

    requirement roboterAnforderungen {
        doc /* Anforderungen an den Indoorroboter, Stand Version 1.0 */
        requirement laufzeit : Laufzeit;
        requirement hindernis : Hinderniserkennung;
        requirement scanrate : Scanrate;
        requirement gewicht : Gewicht;
        requirement notaus : Notaus;
    }

    // Die Scanrate ist aus der Hinderniserkennung abgeleitet
    #derivation connection {
        end #original ::> roboterAnforderungen.hindernis;
        end #derive ::> roboterAnforderungen.scanrate;
    }
}
