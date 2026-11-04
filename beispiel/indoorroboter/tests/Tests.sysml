// Beispielprojekt Indoorroboter – Nachweise
package Tests {
    private import Struktur::*;
    private import Anforderungen::*;

    verification def LaufzeitTest {
        doc /* Dauerlauf auf der Teststrecke mit voll geladenem Akku, Zeit bis zur Abschaltung messen. */
        subject pruefling : Roboter;
        objective {
            verify Anforderungen::roboterAnforderungen.laufzeit;
        }
    }

    verification def HindernisTest {
        doc /* Prüfkörper 10 x 10 cm in 30 cm Abstand an 8 Positionen rund um den Roboter. */
        subject pruefling : Roboter;
        objective {
            verify Anforderungen::roboterAnforderungen.hindernis;
            verify Anforderungen::roboterAnforderungen.scanrate;
        }
    }
}
