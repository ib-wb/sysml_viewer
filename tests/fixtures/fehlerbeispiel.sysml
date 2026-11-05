package Fehlerbeispiel {
    port def DatenPort { out item d : Daten; }
    item def Daten;
    part def Sensor { port aus : DatenPort; }
    part def Rechner { port ein : DatenPort; port debug : DatenPort; }
    part def Gehaeuse;
    part def Kamera { attribute aufloesung : Pixelzahl; }
    part def System {
        part s : Sensor;
        part r : Rechner;
        part k : Kamera;
        connect s.aus to r.ein;
    }
    requirement def <'R1'> Messen { doc /* misst */ }
    requirement messen : Messen;
    part sys : System;
    satisfy messen by sys.s;
    satisfy messenn by sys.r;
    verification def LeererTest { doc /* nichts */ }
    part x : Unbekannt
}
