// CI pipeline for my self-hosted Jenkins (github.com/amirizalrahmat0799/jenkins-ci-lab).
// Each step runs in a throwaway container started next to Jenkins: Maven for the backend, Node for the app.
// `--volumes-from jenkins` shares the Jenkins workspace with that container, and the `ci-lab` network
// lets the integration tests reach the lab's PostgreSQL (ci-postgres).
pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
    }

    environment {
        // One database per executor, so two branches building at once never share test data
        TEST_DB = "kira_ci_${env.EXECUTOR_NUMBER}"
        MAVEN_IMAGE = 'maven:3.9-eclipse-temurin-21'
        NODE_IMAGE = 'node:22'
    }

    stages {
        stage('Checks') {
            parallel {
                stage('Backend') {
                    stages {
                        stage('Test database') {
                            steps {
                                sh '''
                                    docker exec ci-postgres dropdb -U ci --if-exists "$TEST_DB"
                                    docker exec ci-postgres createdb -U ci "$TEST_DB"
                                '''
                            }
                        }
                        stage('Build & test') {
                            steps {
                                sh '''
                                    docker run --rm --volumes-from jenkins --network ci-lab \
                                      -v ci-lab-m2:/root/.m2 \
                                      -w "$WORKSPACE/backend" \
                                      -e KIRA_TEST_DB_URL="jdbc:postgresql://ci-postgres:5432/$TEST_DB" \
                                      -e KIRA_TEST_DB_USER=ci \
                                      -e KIRA_TEST_DB_PASSWORD=ci \
                                      "$MAVEN_IMAGE" mvn -B verify
                                '''
                            }
                            post {
                                always {
                                    junit testResults: 'backend/target/surefire-reports/*.xml', allowEmptyResults: true
                                }
                                success {
                                    archiveArtifacts artifacts: 'backend/target/kira-api-*.jar', fingerprint: true
                                }
                            }
                        }
                        stage('Docker image') {
                            steps {
                                sh 'docker build -t "kira-api:$BUILD_NUMBER" -t kira-api:latest backend'
                            }
                        }
                    }
                }

                stage('Mobile') {
                    steps {
                        sh '''
                            docker run --rm --volumes-from jenkins \
                              -v ci-lab-npm:/root/.npm \
                              -w "$WORKSPACE/mobile" \
                              -e CI=true \
                              "$NODE_IMAGE" sh -c "npm ci && npm run typecheck && npm run lint && npm test -- --ci"
                        '''
                    }
                }
            }
        }
    }

    post {
        always {
            sh 'docker exec ci-postgres dropdb -U ci --if-exists "$TEST_DB" || true'
        }
    }
}
