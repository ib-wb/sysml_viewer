// Sample project indoor robot – verification
package Tests {
    private import Structure::*;
    private import Requirements::*;

    verification def RuntimeTest {
        doc /* Endurance run on the test track with a fully charged battery; measure the time until shutdown. */
        subject unitUnderTest : Robot;
        objective {
            verify Requirements::robotRequirements.runtime;
        }
    }

    verification def ObstacleTest {
        doc /* Test object 10 x 10 cm at a distance of 30 cm in 8 positions around the robot. */
        subject unitUnderTest : Robot;
        objective {
            verify Requirements::robotRequirements.obstacle;
            verify Requirements::robotRequirements.scanRate;
        }
    }
}
