// Beispielprojekt Indoorroboter – Verhalten
private import ScalarValues::*;

package Verhalten {
    private import Disziplinen::*;

    item def Pose;
    item def Pfad;

    #Software state def Betriebszustaende {
        entry; then Bereit;

        state Bereit;
        accept StartBefehl then Navigation;

        state Navigation {
            entry; then Planen;
            state Planen {
                do action pfadSuchen;
            }
            accept PfadGefunden then Fahren;
            state Fahren {
                do action pfadFolgen;
            }
            accept HindernisErkannt then Planen;
        }
        transition zielErreicht first Navigation accept ZielErreicht then Bereit;
        transition first Navigation accept AkkuNiedrig then Laden;

        state Laden {
            entry action andocken;
        }
        transition first Laden accept AkkuVoll then Bereit;
    }

    #Software action def NavigiereZumZiel {
        in item ziel : Pose;
        out item erreicht : Boolean;

        first start;
        then action lokalisieren {
            out item pose : Pose;
        }
        then action pfadPlanen {
            in item pose : Pose;
            in item ziel : Pose;
            out item pfad : Pfad;
        }
        then action pfadFolgen {
            in item pfad : Pfad;
        }
        then decide pruefen;
            if zielErreicht then done;
            else lokalisieren;

        flow from ziel to pfadPlanen.ziel;
        flow from lokalisieren.pose to pfadPlanen.pose;
        flow from pfadPlanen.pfad to pfadFolgen.pfad;
    }
}