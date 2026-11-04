// Beispielprojekt Indoorroboter – Systemebene: Instanz, Umsetzung und Allokation
package System {
    private import Struktur::*;
    private import Anforderungen::*;

    part roboter : Struktur::Roboter;

    // Welche Komponente erfüllt welche Anforderung?
    satisfy Anforderungen::roboterAnforderungen.laufzeit by roboter.akku;
    satisfy Anforderungen::roboterAnforderungen.hindernis by roboter.lidar;
    satisfy Anforderungen::roboterAnforderungen.scanrate by roboter.lidar;
    satisfy Anforderungen::roboterAnforderungen.gewicht by roboter;

    // Die Navigation läuft auf dem Steuerrechner
    allocate Verhalten::NavigiereZumZiel to roboter.rechner;
}
