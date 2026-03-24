package org.example

import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.application.*
import io.ktor.server.routing.*
import io.ktor.server.response.*
import io.ktor.server.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq

// --- Database Table Definition ---
object Tasks : Table("tasks") {
    val id = integer("id").autoIncrement()
    val text = varchar("text", 255)
    val completed = bool("completed").default(false)
    val duration = varchar("duration", 50).nullable()
    override val primaryKey = PrimaryKey(id)
}

// Update Task data class to include duration
@Serializable
data class Task(val id: Int, val text: String, val completed: Boolean, val duration: String? = null)

@Serializable
data class CreateTaskRequest(val text: String)

@Serializable
data class UpdateTaskRequest(val text: String? = null, val completed: Boolean? = null, val duration: String? = null)
// --- Database Setup ---
fun initDatabase() {
    // This creates a file called "tasks.db" in your project folder
    Database.connect("jdbc:sqlite:tasks.db", driver = "org.sqlite.JDBC")

    transaction {
        // Create the table if it doesn't exist yet
        SchemaUtils.create(Tasks)

        // Seed with sample tasks only if the table is empty
        if (Tasks.selectAll().count() == 0L) {
            Tasks.insert { it[text] = "Finish extra credit setup" }
            Tasks.insert { it[text] = "Design homepage layout" }
            Tasks.insert { it[text] = "Connect frontend to Kotlin later" }
        }
    }
}

// --- Helper to convert a DB row to a Task ---
fun rowToTask(row: ResultRow) = Task(
    id = row[Tasks.id],
    text = row[Tasks.text],
    completed = row[Tasks.completed],
    duration = row[Tasks.duration]
)

fun main() {
    initDatabase()

    embeddedServer(Netty, port = 8080) {
        install(CORS) {
            anyHost()
            allowHeader(HttpHeaders.ContentType)
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Put)
            allowMethod(HttpMethod.Delete)
        }
        install(ContentNegotiation) {
            json()
        }
        routing {
            // GET /tasks
            get("/tasks") {
                val tasks = transaction {
                    Tasks.selectAll().map { rowToTask(it) }
                }
                call.respond(tasks)
            }

            // POST /tasks
            post("/tasks") {
                val body = call.receive<CreateTaskRequest>()
                val newTask = transaction {
                    val id = Tasks.insert {
                        it[text] = body.text
                    } get Tasks.id
                    Task(id = id, text = body.text, completed = false)
                }
                call.respond(HttpStatusCode.Created, newTask)
            }

            // PUT /tasks/{id}
            put("/tasks/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@put call.respond(HttpStatusCode.BadRequest)

                val body = call.receive<UpdateTaskRequest>()
                val updated = transaction {
                    Tasks.update({ Tasks.id eq id }) { row ->
                        if (body.text != null) row[Tasks.text] = body.text
                        if (body.completed != null) row[Tasks.completed] = body.completed
                        if (body.duration != null) row[Tasks.duration] = body.duration
                    }
                    Tasks.select { Tasks.id eq id }.map { rowToTask(it) }.firstOrNull()
                }
                if (updated == null) call.respond(HttpStatusCode.NotFound)
                else call.respond(updated)
            }

            // DELETE /tasks/{id}
            delete("/tasks/{id}") {
                val id = call.parameters["id"]?.toIntOrNull()
                    ?: return@delete call.respond(HttpStatusCode.BadRequest)

                val deleted = transaction {
                    Tasks.deleteWhere { Tasks.id eq id }
                }
                if (deleted > 0) call.respond(HttpStatusCode.NoContent)
                else call.respond(HttpStatusCode.NotFound)
            }
        }
    }.start(wait = true)
}