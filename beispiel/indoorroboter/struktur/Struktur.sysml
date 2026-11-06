// Beispielprojekt Indoorroboter – Struktur
private import ScalarValues::*;

package Struktur {
    private import Disziplinen::*;

    attribute def Spannung :> Real;
    attribute def Masse :> Real;

    item def Fahrbefehl {
        attribute v : Real;      // Lineargeschwindigkeit in m/s
        attribute omega : Real;  // Drehrate in rad/s
    }
    item def Scan;

    port def EnergiePort {
        in attribute u : Spannung;
    }
    port def BefehlPort {
        out item cmd : Fahrbefehl;
    }
    port def ScanPort {
        out item scan : Scan;
    }

    interface def Versorgung {
        end quelle : ~EnergiePort;
        end senke : EnergiePort;
    }

    abstract part def Komponente {
        attribute masse : Masse;
    }
    #Elektronik part def Akku :> Komponente {
        attribute kapazitaet : Real = 5.2;
        port ausgang : ~EnergiePort;
    }
    #Elektronik part def Steuerrechner :> Komponente {
        doc /* Raspberry Pi 5 mit ROS 2 Jazzy */
        perform action navigation : Verhalten::NavigiereZumZiel;
        port energie : EnergiePort;
        port scanEin : ~ScanPort;
        port fahrAus : BefehlPort;
    }
    #Elektronik part def Lidar :> Komponente {
        port energie : EnergiePort;
        port scanAus : ScanPort;
    }
    #Elektronik part def Motor :> Komponente {
        attribute nennDrehzahl : Real;
    }
    #Mechanik part def Rad {
        attribute durchmesser : Real = 0.065;
    }
    #Mechanik part def Antrieb {
        port energie : EnergiePort;
        port fahrEin : ~BefehlPort;
        part motorLinks : Motor;
        part motorRechts : Motor;
        part rad : Rad[2];
    }
    part def Roboter {
        attribute gesamtmasse : Masse;
        part akku : Akku;
        part rechner : Steuerrechner;
        part lidar : Lidar;
        part antrieb : Antrieb;

        interface : Versorgung connect akku.ausgang to rechner.energie;
        interface : Versorgung connect akku.ausgang to lidar.energie;
        interface : Versorgung connect akku.ausgang to antrieb.energie;
        connect lidar.scanAus to rechner.scanEin;
        flow of Fahrbefehl from rechner.fahrAus.cmd to antrieb.fahrEin.cmd;

        exhibit state betrieb : Verhalten::Betriebszustaende;
    }
}